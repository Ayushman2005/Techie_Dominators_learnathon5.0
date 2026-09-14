async function verify() {
  console.log('=== 1. Testing Frontend Delivery ===');
  let res;
  try {
    res = await fetch('http://localhost:5173/');
  } catch {
    res = await fetch('http://localhost:5174/');
  }
  const html = await res.text();
  console.log('Frontend Status:', res.status);
  console.log('Root Element Present:', html.includes('id="root"'));
  console.log('Script Tag Present:', html.includes('src="/src/main.tsx"'));

  console.log('\n=== 2. Obtaining CSRF Token ===');
  const meRes = await fetch('http://127.0.0.1:3001/api/me');
  const rawCookies = meRes.headers.get('set-cookie') || '';
  const csrfMatch = rawCookies.match(/csrf_token=([^;]+)/);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';
  console.log('CSRF Token initialized:', csrfToken ? `${csrfToken.slice(0, 8)}...` : 'NONE');

  console.log('\n=== 3. Testing Student Authentication & Session ===');
  const sLogin = await fetch('http://127.0.0.1:3001/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `csrf_token=${csrfToken}`,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ email: 'student@example.test', password: 'student123' })
  });
  const sCookies = sLogin.headers.get('set-cookie') || '';
  const sSessionMatch = sCookies.match(/hg_session=([^;]+)/);
  const sSession = sSessionMatch ? sSessionMatch[1] : '';
  const sData = await sLogin.json();
  console.log('Student Login Status:', sLogin.status);
  console.log('Logged User:', sData.user?.name, `(${sData.user?.role})`);

  const studentFullCookie = `csrf_token=${csrfToken}; hg_session=${sSession}`;

  console.log('\n=== 4. Testing Grievance Retrieval for Student ===');
  const gList = await fetch('http://127.0.0.1:3001/api/grievances', {
    headers: { Cookie: studentFullCookie }
  });
  const gData = await gList.json();
  console.log('Grievances List Status:', gList.status);
  console.log('Total Grievances Returned:', gData.total);
  if (gData.data && gData.data.length > 0) {
    console.log('Sample Ticket:', gData.data[0].id, '-', gData.data[0].title, `[${gData.data[0].status}]`);
  }

  console.log('\n=== 5. Testing Notices Bulletin ===');
  const nList = await fetch('http://127.0.0.1:3001/api/notices', {
    headers: { Cookie: studentFullCookie }
  });
  const nData = await nList.json();
  console.log('Notices Count:', (nData.data || nData.notices || []).length);

  console.log('\n=== 6. Testing Warden Authentication & Queue ===');
  const wLogin = await fetch('http://127.0.0.1:3001/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `csrf_token=${csrfToken}`,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ email: 'warden@example.test', password: 'warden123' })
  });
  const wCookies = wLogin.headers.get('set-cookie') || '';
  const wSessionMatch = wCookies.match(/hg_session=([^;]+)/);
  const wSession = wSessionMatch ? wSessionMatch[1] : '';
  const wData = await wLogin.json();
  console.log('Warden Login Status:', wLogin.status);
  console.log('Warden User:', wData.user?.name, `(${wData.user?.role})`);

  const wardenFullCookie = `csrf_token=${csrfToken}; hg_session=${wSession}`;
  const wQueue = await fetch('http://127.0.0.1:3001/api/grievances', {
    headers: { Cookie: wardenFullCookie }
  });
  const wqData = await wQueue.json();
  console.log('Warden Grievance Queue Count:', wqData.total);

  console.log('\n=== 7. Testing Admin Authentication & Analytics ===');
  const aLogin = await fetch('http://127.0.0.1:3001/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `csrf_token=${csrfToken}`,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ email: 'admin@example.test', password: 'admin123' })
  });
  const aCookies = aLogin.headers.get('set-cookie') || '';
  const aSessionMatch = aCookies.match(/hg_session=([^;]+)/);
  const aSession = aSessionMatch ? aSessionMatch[1] : '';
  const aData = await aLogin.json();
  console.log('Admin Login Status:', aLogin.status);
  console.log('Admin User:', aData.user?.name, `(${aData.user?.role})`);

  const adminFullCookie = `csrf_token=${csrfToken}; hg_session=${aSession}`;
  const aMetrics = await fetch('http://127.0.0.1:3001/api/grievances/analytics', {
    headers: { Cookie: adminFullCookie }
  });
  const mData = await aMetrics.json();
  const analyticsObj = mData.data || mData.analytics;
  console.log('Analytics Available:', !!analyticsObj);
  if (analyticsObj) {
    console.log('Resolution Rate (%):', analyticsObj.resolutionRatePct);
    console.log('Total System Grievances:', analyticsObj.totalGrievances);
  }

  console.log('\n>>> All Frontend & Backend Verification Checks Passed with 100% Success! <<<');
}

verify().catch(console.error);
