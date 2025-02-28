function getSentiment(x) {
  if (x === 'Negative') {
    return -1;
  } else if (x === 'Positive') {
    return 1;
  } else {
    return 0;
  }
}

module.exports = getSentiment;