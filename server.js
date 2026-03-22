const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { db, User, Project, Task } = require('./database/setup');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(session({
    secret: 'super_secret_key',
    resave: false,
    saveUninitialized: false
}));

async function testConnection() {
    try {
        await db.authenticate();
        console.log('Connection to database established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}
testConnection();

const authMiddleware = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    req.user = { id: req.session.userId };
    next();
};
// REGISTER
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            username,
            email,
            password: hashedPassword
        });

        res.json({ message: 'User registered successfully' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        req.session.userId = user.id;

        res.json({ message: 'Login successful' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LOGOUT
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ message: 'Logged out successfully' });
    });
});

// GET all projects (only for logged-in user)
app.get('/api/projects', authMiddleware, async (req, res) => {
    try {
        const projects = await Project.findAll({
            where: { userId: req.user.id }
        });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// GET project by ID
app.get('/api/projects/:id', authMiddleware, async (req, res) => {
    try {
        const project = await Project.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// CREATE project
app.post('/api/projects', authMiddleware, async (req, res) => {
    try {
        const { name, description, status, dueDate } = req.body;

        const newProject = await Project.create({
            name,
            description,
            status,
            dueDate,
            userId: req.user.id
        });

        res.status(201).json(newProject);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// UPDATE project
app.put('/api/projects/:id', authMiddleware, async (req, res) => {
    try {
        const { name, description, status, dueDate } = req.body;

        const [updatedRowsCount] = await Project.update(
            { name, description, status, dueDate },
            {
                where: {
                    id: req.params.id,
                    userId: req.user.id
                }
            }
        );

        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const updatedProject = await Project.findByPk(req.params.id);
        res.json(updatedProject);

    } catch (error) {
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// DELETE project
app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
    try {
        const deletedRowsCount = await Project.destroy({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (deletedRowsCount === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ message: 'Project deleted successfully' });

    } catch (error) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
    const tasks = await Task.findAll();
    res.json(tasks);
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
    const task = await Task.create(req.body);
    res.status(201).json(task);
});

//start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});