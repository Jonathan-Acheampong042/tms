const handleDbError = (err, res) => {
  console.error(err);

  switch (err.code) {
    case '23505':
      return res.status(409).json({ message: 'That value already exists (e.g. duplicate plate number).' });
    case '23514':
      return res.status(400).json({ message: 'A value is not allowed for this field.', constraint: err.constraint });
    case '23502':
      return res.status(400).json({ message: `Missing required field: ${err.column}` });
    case '23503':
      return res.status(409).json({ message: 'This record is linked to other records and cannot be changed or deleted.' });
    case '22P02':
    case '22007':
      return res.status(400).json({ message: 'Invalid value or id format.' });
    default:
      return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = handleDbError;
