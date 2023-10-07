const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/public', express.static(process.cwd() + '/public'));
app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'));

const exerciseUsersSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true }
});

const ExercisesSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, min: 1, required: true },
  date: { type: Date, default: Date.now }
});

const ExerciseUsers = mongoose.model('ExerciseUsers', exerciseUsersSchema);
const Exercises = mongoose.model('Exercises', ExercisesSchema);

app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.json({ error: 'username is required' });

    let user = await ExerciseUsers.findOne({ username }).exec();
    if (!user) {
      user = await ExerciseUsers.create({ username });
    }

    return res.json({ _id: user._id, username: user.username });
  } catch (err) {
    console.error('Error occurred:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await ExerciseUsers.find().exec();
    return res.json(users);
  } catch (err) {
    console.error('Error occurred:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const { _id } = req.params;
    const { description, duration, date } = req.body;

    if (!_id || _id === '0') return res.json({ error: '_id is required' });
    if (!description) return res.json({ error: 'description is required' });
    if (!duration || isNaN(duration)) return res.json({ error: 'duration is not a number' });

    const user = await ExerciseUsers.findById(_id).exec();
    if (!user) return res.json({ error: 'user not found' });

    const newExercise = await Exercises.create({
      userId: _id,
      description,
      duration,
      date: date ? new Date(date) : new Date()
    });

    return res.json({
      _id: user._id,
      username: user.username,
      description: newExercise.description,
      duration: newExercise.duration,
      date: new Date(newExercise.date).toDateString()
    });
  } catch (err) {
    console.error('Error occurred:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { _id } = req.params;
    const { from, to, limit } = req.query;

    if (!_id) return res.json({ error: '_id is required' });

    let findConditions = { userId: _id };

    if (from && !isNaN(new Date(from))) findConditions.date = { $gte: new Date(from) };
    if (to && !isNaN(new Date(to))) {
      findConditions.date = findConditions.date || {};
      findConditions.date.$lte = new Date(to);
    }

    let exercises = await Exercises.find(findConditions).sort({ date: 'asc' }).limit(Number(limit) || 0).exec();

    return res.json({
      _id,
      username: exercises.length > 0 ? exercises[0].username : null,
      log: exercises.map(e => ({
        description: e.description,
        duration: e.duration,
        date: new Date(e.date).toDateString()
      })),
      count: exercises.length
    });
  } catch (err) {
    console.error('Error occurred:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.use((req, res, next) => next({ status: 404, message: 'not found' }));
app.use((err, req, res, next) => {
  const errCode = err.status || 500;
  const errMessage = err.message || 'Internal Server Error';
  return res.status(errCode).type('txt').send(errMessage);
});

const PORT = process.env.PORT || 3000;
const listener = app.listen(PORT, () => console.log('Your app is listening on port ' + PORT));
