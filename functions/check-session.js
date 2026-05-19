export async function onRequestGet(context) {
  const { request } = context;
  
  // 1. Extract the cookie from the browser request headers
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/discord_session=([^;]+)/);
  
  if (!match) {
    return new Response(JSON.stringify({ loggedIn: false }), { status: 401 });
  }

  const accessToken = match[1];

  try {
    // 2. Ask Discord who this access token belongs to
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      return new Response(JSON.stringify({ loggedIn: false }), { status: 401 });
    }

    const userData = await userResponse.json();

    // 3. Send their basic profile data back to your vanilla JavaScript frontend
    return new Response(JSON.stringify({
      loggedIn: true,
      username: userData.global_name || userData.username, // Uses display name if available
      avatar: userData.avatar,
      id: userData.id
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}