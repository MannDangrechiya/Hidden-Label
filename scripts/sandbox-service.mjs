import http from "node:http";
import crypto from "node:crypto";

const RAZORPAY_PORT = 9099;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "secret_thl_sandbox_key_999";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "secret_thl_webhook_999";

const orders = new Map();
const payments = new Map();
const refunds = new Map();

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const razorpayServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const method = req.method ?? "GET";
    const path = url.pathname.replace(/^\/v1/, "");

    // 1. POST /orders
    if (method === "POST" && path === "/orders") {
      const data = await parseJson(req);
      const id = `order_test_${crypto.randomBytes(8).toString("hex")}`;
      const amount = Number(data.amount ?? 0);
      const order = {
        id,
        amount,
        currency: String(data.currency ?? "INR").toUpperCase(),
        status: "created",
        notes: data.notes ?? {},
        created_at: Math.floor(Date.now() / 1000),
      };
      orders.set(id, order);

      // Pre-create simulated payment for this order
      const paymentId = `pay_test_${crypto.randomBytes(8).toString("hex")}`;
      const signature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${id}|${paymentId}`)
        .digest("hex");

      const payment = {
        id: paymentId,
        order_id: id,
        amount,
        currency: order.currency,
        status: "authorized",
        notes: order.notes,
        created_at: Math.floor(Date.now() / 1000),
      };
      payments.set(paymentId, payment);

      // Send order with extra simulation payload attached for dev convenience
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ...order,
        simulated: {
          payment_id: paymentId,
          signature,
        },
      }));
      return;
    }

    // 2. GET /payments/:id
    const paymentMatch = path.match(/^\/payments\/([^/]+)$/);
    if (method === "GET" && paymentMatch) {
      const paymentId = paymentMatch[1];
      const payment = payments.get(paymentId);
      if (!payment) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR", description: "Payment not found" } }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payment));
      return;
    }

    // 3. POST /payments/:id/capture
    const captureMatch = path.match(/^\/payments\/([^/]+)\/capture$/);
    if (method === "POST" && captureMatch) {
      const paymentId = captureMatch[1];
      const data = await parseJson(req);
      const payment = payments.get(paymentId);
      if (!payment) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR", description: "Payment not found" } }));
        return;
      }
      payment.status = "captured";
      if (data.amount) payment.amount = Number(data.amount);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payment));
      return;
    }

    // 4. POST /payments/:id/refund
    const refundMatch = path.match(/^\/payments\/([^/]+)\/refund$/);
    if (method === "POST" && refundMatch) {
      const paymentId = refundMatch[1];
      const data = await parseJson(req);
      const payment = payments.get(paymentId);
      if (!payment) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR", description: "Payment not found" } }));
        return;
      }
      const id = `rfn_test_${crypto.randomBytes(8).toString("hex")}`;
      const refund = {
        id,
        payment_id: paymentId,
        amount: Number(data.amount ?? payment.amount),
        status: "processed",
        created_at: Math.floor(Date.now() / 1000),
      };
      refunds.set(id, refund);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(refund));
      return;
    }

    // 5. GET /orders/:id/simulated-payment
    const simMatch = path.match(/^\/orders\/([^/]+)\/simulated-payment$/);
    if (method === "GET" && simMatch) {
      const orderId = simMatch[1];
      for (const [pId, p] of payments.entries()) {
        if (p.order_id === orderId) {
          const sig = crypto
            .createHmac("sha256", RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${pId}`)
            .digest("hex");
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({
            order_id: orderId,
            payment_id: pId,
            signature: sig,
            amount: p.amount,
          }));
          return;
        }
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Order not found" }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Not found: ${method} ${path}` }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: err.message } }));
  }
});

razorpayServer.listen(RAZORPAY_PORT, "127.0.0.1", () => {
  console.log(`● Razorpay Sandbox Server ready on http://127.0.0.1:${RAZORPAY_PORT}/v1`);
});
