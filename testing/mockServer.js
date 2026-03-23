const http = require('http');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const port = process.env.MOCK_SERVER_PORT || 3010;

http.createServer(async function (req, res) {

  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  await delay(1000);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    "statusCode": 200,
    "body": {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "This is a problematic passage."
      },
      "finish_reason": "stop"
    }
  }));
}).listen(port, () => {
  console.log(`Mock server running on port ${port}`);
});
