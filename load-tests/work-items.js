
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (
  __ENV.API_BASE_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

const TOKEN = __ENV.AUTH_TOKEN;

export const options = {
  stages: [
    { duration: "1m", target: 5 },
    { duration: "2m", target: 25 },
    { duration: "2m", target: 100 },
    { duration: "2m", target: 250 },
    { duration: "5m", target: 500 },
    { duration: "5m", target: 1000 },
    { duration: "1m", target: 0 },
  ],

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  if (!TOKEN) {
    throw new Error("Set AUTH_TOKEN to a valid test-user JWT.");
  }

  const response = http.get(
    `${BASE_URL}/work-items?page=1&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json",
      },
      tags: { endpoint: "list_work_items" },
    }
  );

  // Log the response after the request completes.
  console.log(
    `Status: ${response.status}, Body: ${response.body}`
  );

  check(response, {
    "returns HTTP 200": (r) => r.status === 200,
    "returns JSON": (r) =>
      (r.headers["Content-Type"] || "").includes("application/json"),
  });

  sleep(1);
}
