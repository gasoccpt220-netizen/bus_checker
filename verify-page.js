const http = require('http');
http.get('http://localhost:3000', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data.includes('id="status"') ? 'page served' : 'page missing');
  });
}).on('error', (err) => {
  console.error(err);
  process.exit(1);
});
