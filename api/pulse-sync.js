module.exports = async function pulseSync(req, res) {
  res.statusCode = 501;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: false,
    message: 'Soteria Pulse API sync is a placeholder. Send validated lead/customer profiles and order records to Pulse here.'
  }));
};
