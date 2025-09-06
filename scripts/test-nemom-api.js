/**
 * Test script for Nemom temperature API
 */

import fetch from 'node-fetch';

async function testNemomTemperature() {
    try {
        console.log('🧪 Testing Nemom temperature API...');

        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'What is the temperature in Nemom?' }]
            })
        });

        if (!response.ok) {
            console.error('❌ HTTP Error:', response.status, response.statusText);
            return;
        }

        const data = await response.json();
        console.log('✅ Response received:');
        console.log('Text:', data.text);
        console.log('Environmental Data:', data.environmentalData);
        console.log('Analysis:', data.analysis);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testNemomTemperature();
