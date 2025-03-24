let totalPoints = 0;
const energyData = { organic: 0, recyclable: 0, nonRecyclable: 0 };
let chartInstance = null;
let challengeProgress = 0;
const challengeGoal = 5;
let totalCarbonSaved = 0;

document.getElementById('wasteForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = e.target.type.value;
  const amount = parseFloat(e.target.amount.value);

  const res = await fetch('/log-waste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, amount, username: 'DemoUser' })
  });
  const data = await res.json();

  document.getElementById('result').innerHTML = `Energy: ${data.energy} kWh, Points: ${data.points}<br><span class="text-green-600">${data.tip}</span>`;
  totalPoints += data.points;

  const carbonSaved = data.energy * 0.5;
  totalCarbonSaved += carbonSaved;
  animateCounter('carbonSaved', totalCarbonSaved);

  if (type === 'organic') {
    challengeProgress += amount;
    document.getElementById('challengeStatus').innerText = `Progress: ${challengeProgress.toFixed(1)}/${challengeGoal} kg`;
    if (challengeProgress >= challengeGoal && document.getElementById('challengeModal').classList.contains('hidden')) {
      totalPoints += 50;
      document.getElementById('challengeModal').classList.remove('hidden');
      document.getElementById('challengeReward').classList.remove('hidden');
      document.getElementById('challengeReward').classList.add('block');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      await fetch('/add-bonus-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'DemoUser', points: 50 })
      });
    }
  }
  document.getElementById('points').innerHTML = `Total Points: ${totalPoints}`;

  if (type === 'organic') energyData.organic += data.energy;
  else if (type === 'recyclable') energyData.recyclable += data.energy;
  else energyData.nonRecyclable += data.energy;
  updateChart();
  if (document.getElementById('totalWaste')) updateStats();
});

document.getElementById('wastePhoto')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('photo', file);

  const res = await fetch('/analyze-waste', { method: 'POST', body: formData });
  const data = await res.json();

  document.getElementById('result').innerHTML = `
    AI Suggestion: ${data.type} (${data.confidence}% confidence)<br>
    <span class="text-blue-600">${data.tip}</span><br>
    <button id="aiFeedback" class="mt-2 bg-gray-200 p-1 rounded text-sm">Was this correct?</button>
  `;
  document.querySelector('select[name="type"]').value = data.type;

  document.getElementById('aiFeedback').addEventListener('click', () => {
    alert('Thanks for the feedback! This will improve our AI in the future.');
  });
});

document.getElementById('closeModal')?.addEventListener('click', () => {
  document.getElementById('challengeModal').classList.add('hidden');
});

function updateChart() {
  const ctx = document.getElementById('energyChart')?.getContext('2d');
  if (!ctx) return;

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Organic', 'Recyclable', 'Non-Recyclable'],
      datasets: [{ label: 'Energy (kWh)', data: [energyData.organic, energyData.recyclable, energyData.nonRecyclable], backgroundColor: ['#4CAF50', '#2196F3', '#F44336'] }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

async function updateLeaderboard() {
  const res = await fetch('/leaderboard');
  const data = await res.json();
  document.getElementById('leaderboard').innerHTML = data.map((row, i) => `<p>${i + 1}. ${row.username}: ${row.total_points} points</p>`).join('');
}
if (document.getElementById('leaderboard')) updateLeaderboard();

async function updateStats() {
  const res = await fetch('/stats');
  const data = await res.json();
  animateCounter('totalWaste', data.totalWaste);
  animateCounter('totalEnergy', data.totalEnergy);
  animateCounter('co2Avoided', data.co2Avoided);
}

function animateCounter(id, endValue) {
  let start = 0;
  const element = document.getElementById(id);
  const step = endValue / 50;
  const interval = setInterval(() => {
    start += step;
    if (start >= endValue) {
      start = endValue;
      clearInterval(interval);
    }
    element.innerText = Math.round(start * 10) / 10 + (id === 'carbonSaved' || id === 'co2Avoided' ? ' kg CO2' : id === 'totalEnergy' ? ' kWh' : ' kg');
  }, 20);
}
if (document.getElementById('totalWaste')) updateStats();

// New Community Waste Map Initialization
if (document.getElementById('map')) {
  const map = L.map('map').setView([51.505, -0.09], 13); // Default: London
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  L.marker([51.5, -0.09]).addTo(map).bindPopup('Recycling Center').openPopup();
}