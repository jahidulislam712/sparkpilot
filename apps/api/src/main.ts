import { createApp } from "./app.js";

const host = "0.0.0.0";
const port = 3000;

createApp().listen(port, host, () => {
  process.stdout.write(`SparkPilot API listening on http://${host}:${port}\n`);
});
