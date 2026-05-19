export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // 1. If there's no code in the URL, the user just clicked "Login". 
  // We need to bounce them directly to Discord's official Authorization page.
  if (!code) {
    // Replace these placeholder strings with your actual IDs from the Discord Developer Portal
    const CLIENT_ID = env.DISCORD_CLIENT_ID; 
    const REDIRECT_URI = encodeURIComponent(`${url.origin}/functions/auth`);
    const SCOPES = encodeURIComponent("identify guilds.members.read");

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${SCOPES}`;
    
    return Response.redirect(discordAuthUrl, 302);
  }

  try {
    // 2. The user authorized your app, and Discord sent them back with a ?code=XYZ
    // Now, your backend securely trades that code for a real Access Token.
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: `${url.origin}/functions/auth`,
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return new Response(`Discord Token Error: ${tokenData.error_description || "Unknown error"}`, { status: 400 });
    }

    const accessToken = tokenData.access_token;

    // 3. Use the token to ask Discord: "Is this user a member of my specific Albion guild server?"
    const GUILD_ID = env.DISCORD_GUILD_ID; // Your Discord Server ID
    const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (memberResponse.status === 404) {
      // The user isn't even in your Discord server
      return Response.redirect(`${url.origin}/index.html?error=not_in_server`, 302);
    }

    const memberData = await memberResponse.json();

    // 4. Check if they have the specific role required to view the regear/battleboard pages
    const REQUIRED_ROLE_ID = env.DISCORD_REQUIRED_ROLE_ID; // Your "Member" or "Raider" Role ID
    const hasRole = memberData.roles.includes(REQUIRED_ROLE_ID);

    if (!hasRole) {
      // They are in the server, but don't have the permissions/rank needed
      return Response.redirect(`${url.origin}/index.html?error=missing_role`, 302);
    }

    // 5. SUCCESS! They passed all security checks.
    // Drop a secure cookie in their browser that lasts for 7 days.
    const response = Response.redirect(`${url.origin}/regear.html`, 302);
    
    // HttpOnly and Secure flags mean JavaScript cannot steal this token, keeping it completely safe.
    response.headers.set(
      "Set-Cookie",
      `discord_session=${accessToken}; Path=/; HttpOnly; Secure; Max-Age=604800; SameSite=Strict`
    );

    return response;

  } catch (error) {
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}