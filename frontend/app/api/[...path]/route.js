// Same-origin gateway keeps internal backend addresses and database credentials
// server-side, and works when the UI is opened from another device.
async function proxy(request, { params }) {
  const { path } = await params;
  if (
    !path?.length ||
    !['settings', 'dashboard', 'focus_areas', 'subtopics', 'sessions'].includes(path[0])
  ) {
    return Response.json({ error: 'Unknown API route.' }, { status: 404 });
  }
  const base = process.env.INTERNAL_API_URL || 'http://localhost:4000';
  const url = `${base}/api/${path.map(encodeURIComponent).join('/')}`;
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: { 'Content-Type': 'application/json' },
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { error: 'The learning service is unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
