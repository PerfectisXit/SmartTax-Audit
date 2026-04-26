const https = require('https');

const postJson = (url, headers, body) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers }, (resp) => {
      let data = '';
      resp.on('data', (chunk) => {
        data += chunk.toString();
      });
      resp.on('end', () => {
        resolve({ status: resp.statusCode || 0, data, headers: resp.headers });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

const getJson = (url, headers) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, (resp) => {
      let data = '';
      resp.on('data', (chunk) => {
        data += chunk.toString();
      });
      resp.on('end', () => {
        resolve({ status: resp.statusCode || 0, data, headers: resp.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });

module.exports = {
  postJson,
  getJson,
};
