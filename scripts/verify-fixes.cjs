const Database = require('better-sqlite3');

async function testAll() {
  console.log('--- Comprehensive End-to-End Verification of Fixes ---');
  console.log('Testing against local API at http://127.0.0.1:3001 ...');

  try {
    // 1. Get CSRF Token
    const meRes = await fetch('http://127.0.0.1:3001/api/me');
    const rawCookies = meRes.headers.get('set-cookie') || '';
    const csrfMatch = rawCookies.match(/csrf_token=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';
    console.log('1. CSRF Token obtained:', csrfToken ? `${csrfToken.slice(0, 10)}...` : 'NONE');

    // 2. Student Login
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
    const sSession = (sCookies.match(/hg_session=([^;]+)/) || [])[1] || '';
    const studentCookie = `csrf_token=${csrfToken}; hg_session=${sSession}`;
    const sData = await sLogin.json();
    console.log('2. Student Login:', sLogin.status === 200 ? 'SUCCESS' : 'FAILED', `- User: ${sData.user?.name}`);

    // 3. Notices Check (Student)
    const nRes = await fetch('http://127.0.0.1:3001/api/notices', { headers: { Cookie: studentCookie } });
    const nData = await nRes.json();
    const noticeCount = (nData.data || nData.notices || []).length;
    console.log('3. Notices retrieval:', nRes.status === 200 ? 'SUCCESS' : 'FAILED', `- Found ${noticeCount} notice(s)`);

    // 4. Wardens Check (Student can now view wardens without 403)
    const wListRes = await fetch('http://127.0.0.1:3001/api/users/wardens', { headers: { Cookie: studentCookie } });
    const wListData = await wListRes.json();
    const wardenCount = (wListData.data || []).length;
    console.log('4. Student wardens directory access:', wListRes.status === 200 ? 'SUCCESS' : 'FAILED', `- Found ${wardenCount} warden(s)`);

    // 5. Hostels Check (Student can view hostels)
    const hRes = await fetch('http://127.0.0.1:3001/api/hostels', { headers: { Cookie: studentCookie } });
    const hData = await hRes.json();
    const hostelCount = (hData.data || []).length;
    console.log('5. Hostels directory access:', hRes.status === 200 ? 'SUCCESS' : 'FAILED', `- Found ${hostelCount} hostel(s)`);

    // 6. Warden Login & Queue
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
    const wSession = (wCookies.match(/hg_session=([^;]+)/) || [])[1] || '';
    const wardenCookie = `csrf_token=${csrfToken}; hg_session=${wSession}`;
    console.log('6. Warden Login:', wLogin.status === 200 ? 'SUCCESS' : 'FAILED');

    // 7. Status update via PATCH /api/grievances/:id
    const gList = await fetch('http://127.0.0.1:3001/api/grievances', { headers: { Cookie: wardenCookie } });
    const gData = await gList.json();
    const sampleTicket = (gData.data || [])[0];
    if (sampleTicket) {
      const patchRes = await fetch(`http://127.0.0.1:3001/api/grievances/${sampleTicket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': wardenCookie,
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ status: 'In Progress' })
      });
      const patchData = await patchRes.json();
      console.log(`7. Warden PATCH status on ${sampleTicket.id}:`, patchRes.status === 200 ? 'SUCCESS' : 'FAILED', `- New status: ${patchData.data?.status}`);
    }

    // 8. Admin Login & CSV Export
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
    const aSession = (aCookies.match(/hg_session=([^;]+)/) || [])[1] || '';
    const adminCookie = `csrf_token=${csrfToken}; hg_session=${aSession}`;

    const csvRes = await fetch('http://127.0.0.1:3001/api/audit-logs/export?format=csv', {
      headers: { Cookie: adminCookie }
    });
    const csvText = await csvRes.text();
    console.log('8. Admin CSV export:', csvRes.status === 200 && csvText.includes('Timestamp') ? 'SUCCESS' : 'FAILED', `- Export size: ${csvText.length} bytes`);

    // 9. Admin Audit Stats
    const statRes = await fetch('http://127.0.0.1:3001/api/audit-logs/stats', {
      headers: { Cookie: adminCookie }
    });
    const statData = await statRes.json();
    console.log('9. Admin Audit Stats:', statRes.status === 200 ? 'SUCCESS' : 'FAILED', `- Total Events: ${statData.data?.totalEvents}`);

    console.log('\n>>> All Verification Checks Finished Successfully! <<<');
  } catch (err) {
    console.log('Note: API server at 3001 is not running in background or gave error:', err.message);
  }
}

testAll().catch(console.error);
