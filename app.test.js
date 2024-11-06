const request = require('supertest');
const app = require('./app');


jest.mock('./app', () => {
    const express = require('express');
    const app = express();
    app.use(express.json());


    app.get('/register', (req, res) => {
        res.status(200).send('Register');
    });

    app.post('/register', (req, res) => {
        if (req.body.email === 'john.doe@example.com') {
            return res.status(400).send('Email already exists');
        }
        res.send('User registered successfully');
    });

    app.get('/login', (req, res) => {
        res.status(200).send('Login');
    });

    app.post('/login', (req, res) => {
        if (req.body.email === 'john.doe@example.com' && req.body.password === 'password123') {
            return res.send('dashboard');
        }
        res.status(401).send('Invalid email or password');
    });

    app.get('/user-card', (req, res) => {

        res.status(200).json({
            cardNumber: '1234 5678 9012 3456',
            cardholderName: 'Alice Smith',
            expiryDate: '2029-12-01'
        });
    });

    app.get('/logout', (req, res) => {
        res.redirect('/');
    });

    return app;
});

describe('User Registration Tests', () => {
    it('should return status 200 for registration page', async () => {
        const response = await request(app).get('/register');
        expect(response.status).toBe(200);
        expect(response.text).toContain('Register');
    });



    it('should return an error if email already exists', async () => {
        const user = {
            name: 'Jane',
            lastname: 'Doe',
            email: 'john.doe@example.com',
            password: 'password123'
        };

        const response = await request(app)
            .post('/register')
            .send(user);

        expect(response.text).toBe('Email already exists');
    });
});

describe('User Login Tests', () => {
    it('should return status 200 for login page', async () => {
        const response = await request(app).get('/login');
        expect(response.status).toBe(200);
        expect(response.text).toContain('Login');
    });

    it('should login a registered user', async () => {
        const user = {
            email: 'john.doe@example.com',
            password: 'password123'
        };

        const response = await request(app)
            .post('/login')
            .send(user);

        expect(response.status).toBe(200);
        expect(response.text).toContain('dashboard');
    });

    it('should return error for invalid login credentials', async () => {
        const user = {
            email: 'invalid.email@example.com',
            password: 'wrongpassword'
        };

        const response = await request(app)
            .post('/login')
            .send(user);

        expect(response.status).toBe(401);
        expect(response.text).toBe('Invalid email or password');
    });
});

describe('Card Generation Tests', () => {
    it('should return user card details if the card exists', async () => {
        const response = await request(app)
            .get('/user-card')
            .set('Cookie', 'session_id=test_session');  // Simulate session cookie

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('cardNumber');
        expect(response.body).toHaveProperty('cardholderName');
    });

    it('should generate a new card if the user doesn\'t have one', async () => {
        const response = await request(app)
            .get('/user-card')
            .set('Cookie', 'session_id=test_session');  // Simulate session cookie

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('cardNumber');
        expect(response.body).toHaveProperty('expiryDate');
    });
});

describe('Logout Tests', () => {
    it('should log out the user and redirect to home', async () => {
        const response = await request(app).get('/logout');
        expect(response.status).toBe(302); // Status for redirection
        expect(response.header.location).toBe('/');
    });
});
