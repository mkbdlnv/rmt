const request = require('supertest');
const app = require('./app'); // Adjust the path if necessary
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Create a new pool instance for tests
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'rmt_test', // Use a test database
    password: 'postgres',
    port: 5432,
});

beforeAll(async () => {
    // Optionally: Set up your test database schema here
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            lastname VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS cards (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            card_number VARCHAR(16) NOT NULL,
            cardholder_name VARCHAR(255) NOT NULL,
            expiry_date DATE NOT NULL,
            cvv VARCHAR(3) NOT NULL
        );
    `);
});

afterAll(async () => {
    // Clean up and close the database connection after tests
    await pool.query('DROP TABLE IF EXISTS cards;');
    await pool.query('DROP TABLE IF EXISTS users;');
    await pool.end();
});

describe('User Registration and Login', () => {
    it('should register a new user', async () => {
        const response = await request(app)
            .post('/register')
            .send({
                name: 'John',
                lastname: 'Doe',
                email: 'john.doe@example.com',
                password: 'password123',
            });

        expect(response.statusCode).toBe(200);
        expect(response.text).toBe('User registered successfully');
    });

    it('should not register a user with an existing email', async () => {
        const response = await request(app)
            .post('/register')
            .send({
                name: 'Jane',
                lastname: 'Doe',
                email: 'john.doe@example.com', // Same email as the previous test
                password: 'password456',
            });

        expect(response.statusCode).toBe(200);
        expect(response.text).toBe('Email already exists');
    });

    it('should log in an existing user', async () => {
        const response = await request(app)
            .post('/login')
            .send({
                email: 'john.doe@example.com',
                password: 'password123',
            });

        expect(response.statusCode).toBe(200);
        expect(response.text).toContain('dashboard'); // Assuming 'dashboard' is part of the response
    });

    it('should not log in with incorrect password', async () => {
        const response = await request(app)
            .post('/login')
            .send({
                email: 'john.doe@example.com',
                password: 'wrongpassword',
            });

        expect(response.statusCode).toBe(401);
        expect(response.text).toBe('Invalid email or password');
    });
});

describe('User Card Creation', () => {
    let userId;

    beforeAll(async () => {
        // Create a user to test card creation
        const result = await pool.query(`
            INSERT INTO users (name, lastname, email, password) 
            VALUES ('Alice', 'Smith', 'alice.smith@example.com', '${await bcrypt.hash('password123', 10)}') 
            RETURNING id;
        `);
        userId = result.rows[0].id;
    });

    it('should create a new card for the logged-in user', async () => {
        // Simulate login
        await request(app)
            .post('/login')
            .send({
                email: 'alice.smith@example.com',
                password: 'password123',
            });

        const response = await request(app)
            .get('/user-card')
            .set('Cookie', [`connect.sid=s%3A${userId}.dummySession`]); // Adjust the session cookie as needed

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('cardNumber');
        expect(response.body).toHaveProperty('cardholderName');
    });

    it('should return existing card details if card already exists', async () => {
        // Insert a card directly into the database for testing
        await pool.query(`
            INSERT INTO cards (user_id, card_number, cardholder_name, expiry_date, cvv) 
            VALUES ($1, '1234 5678 9012 3456', 'Alice Smith', '2029-12-01', '123');`, 
            [userId]
        );

        const response = await request(app)
            .get('/user-card')
            .set('Cookie', [`connect.sid=s%3A${userId}.dummySession`]);

        expect(response.statusCode).toBe(200);
        expect(response.body.cardNumber).toBe('1234 5678 9012 3456');
        expect(response.body.cardholderName).toBe('Alice Smith');
    });
});
