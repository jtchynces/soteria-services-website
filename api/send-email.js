module.exports = async function sendEmail(req, res) {
  res.statusCode = 501;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: false,
    message: 'Email notifications are a placeholder. Add staff alerts and customer confirmations here.'
  }));
};
