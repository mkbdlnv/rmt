// Import necessary libraries
const { Pool } = require('pg');
const { DecisionTreeClassifier } = require('scikit-learn');
const express = require('express');

const app = express();
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'rmt',
    password: 'postgres',
    port: 5432,
});

// Simulate a function to fetch login data (fraudulent and non-fraudulent)
async function getLoginData() {
    const result = await pool.query('SELECT * FROM login_data');
    return result.rows;
}

// Preprocessing and Feature Extraction for ML
function preprocessLoginData(data) {
    return data.map((entry) => {
        return [
            entry.login_time_hour, // Hour of the login (e.g., 15 for 3 PM)
            entry.ip_address, // IP address
            entry.location, // Location: encoded as a number or categorical
            entry.is_fraudulent, // Whether it's a fraudulent login (1 or 0)
        ];
    });
}

// Train the ML Model
async function trainFraudDetectionModel() {
    const loginData = await getLoginData();
    const processedData = preprocessLoginData(loginData);

    const X = processedData.map((entry) => entry.slice(0, -1)); // Features
    const y = processedData.map((entry) => entry.slice(-1)); // Labels (fraudulent or not)

    const classifier = new DecisionTreeClassifier();
    classifier.fit(X, y);

    return classifier;
}

// Endpoint for user login
app.post('/login', async (req, res) => {
    const { email, password, ipAddress, loginTime, location } = req.body;

    try {
        // Verify user (login logic)
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user || user.password !== password) {
            return res.status(401).send('Invalid email or password');
        }

        // Predict fraudulence using the trained model
        const classifier = await trainFraudDetectionModel();

        // Prepare features for prediction
        const features = [
            new Date(loginTime).getHours(), // Hour of login
            ipAddress, // IP address
            location, // Location
        ];

        // Predict if this login is fraudulent
        const prediction = classifier.predict([features]);

        if (prediction === 1) {
            // If the login is predicted as fraudulent, alert the user
            return res.status(403).send('Suspicious login detected, access denied.');
        }

        // Successful login
        res.send('Login successful');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

// Start the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
