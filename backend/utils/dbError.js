const handleDbError = (err, res) => {
  console.error(err);

  if (err.code === 'NO_FIELDS') {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 'P0001') {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 'P0002') {
    return res.status(404).json({ message: err.message });
  }

  switch (err.code) {
    case '23505':
      if (['users_username_key', 'users_email_key'].includes(err.constraint)) {
        return res.status(409).json({ message: 'That username or email is already in use.' });
      }
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
