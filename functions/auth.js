export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // --- 🛠️ HARDCODED CONFIGURATION ---
    const CONFIG = {
      CLIENT_ID: "1506314927504228462",
      CLIENT_SECRET: "6U7GbDjwiIc8ser0DIp10yJZTg-OkwPo",
      GUILD_ID: "1427737533059563615",
      REQUIRED_ROLE_ID: "1431269793893454024",
      
      // Your exact Cloudflare worker address (no trailing slash)
      WORKER_URL: "https://nofreethinkers.gaming07center.workers.dev",
      // Where the user lands on your main site after logging in successfully
      FINAL_DESTINATION: "https://nofreethinkers.com/index.html"
    };
    // ----------------------------------

    // Because standard workers don't use file routing automatically, 
    // we check if the URL path ends with /functions/auth or /auth
    if (url.pathname === "/functions/auth" || url.pathname === "/auth") {
      const code = url.searchParams.get("code");
      const REDIRECT_URI = `${CONFIG.WORKER_URL}/functions/auth`;

      // 1. If there's no code in the URL, the user needs to login.
      if (!code) {
        const SCOPES = encodeURIComponent("identify guilds.members.read");
        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${SCOPES}`;
        
        return Response.redirect(discordAuthUrl, 302);
      }

      try {
        // 2. Trade the temporary code for a secure Access Token.
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: CONFIG.CLIENT_ID,
            client_secret: CONFIG.CLIENT_SECRET,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI,
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

        // 3. Verify if they are in your specific Albion server guild
        const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${CONFIG.GUILD_ID}/member`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (memberResponse.status === 404) {
          return Response.redirect("https://nofreethinkers.com/index.html?error=not_in_server", 302);
        }

        const memberData = await memberResponse.json();

        // 4. Check if they have the necessary guild rank/role
        const hasRole = memberData.roles.includes(CONFIG.REQUIRED_ROLE_ID);

        if (!hasRole) {
          return Response.redirect("https://nofreethinkers.com/index.html?error=missing_role", 302);
        }

        // 5. SUCCESS! Set the session cookie and redirect them to your regear dashboard.
        const response = Response.redirect(CONFIG.FINAL_DESTINATION, 302);
        
        // Target .nofreethinkers.com so your main site can read the authentication status
        response.headers.set(
          "Set-Cookie",
          `discord_session=${accessToken}; Path=/; Domain=.nofreethinkers.com; HttpOnly; Secure; Max-Age=604800; SameSite=Lax`
        );

        return response;

      } catch (error) {
        return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
      }
    }

    // Default response if they visit the root worker link directly without a path
    return new Response("Worker is live! Please use the login button on your main website.", { status: 200 });
  }
};