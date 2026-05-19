export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // --- 🛠️ HARDCODED CONFIGURATION ---
    const CONFIG = {
      CLIENT_ID: "1506314927504228462",
      CLIENT_SECRET: "6U7GbDjwiIc8ser0DIp10yJZTg-OkwPo",
      GUILD_ID: "1427737533059563615",
      REQUIRED_ROLE_ID: "1431269793893454024",

      WORKER_URL: "https://nofreethinkers.gaming07center.workers.dev",
      FINAL_DESTINATION: "https://nofreethinkers.com/regear.html"
    };
    // ----------------------------------

    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://nofreethinkers.com",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
      "Content-Type": "application/json"
    };

    // Handle browser Preflight OPTIONS requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ========================================================
    // ROUTE 1: Discord OAuth Callback (/functions/auth)
    // ========================================================
    if (url.pathname === "/functions/auth" || url.pathname === "/auth") {
      const code = url.searchParams.get("code");
      const REDIRECT_URI = `${CONFIG.WORKER_URL}/functions/auth`;

      if (!code) {
        const SCOPES = encodeURIComponent("identify guilds.members.read");
        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${SCOPES}`;
        return Response.redirect(discordAuthUrl, 302);
      }

      try {
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: CONFIG.CLIENT_ID,
            client_secret: CONFIG.CLIENT_SECRET,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI,
          }),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
          return new Response(`Discord Token Error: ${tokenData.error_description}`, { status: 400 });
        }

        const accessToken = tokenData.access_token;

        // Verify Guild Membership
        const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${CONFIG.GUILD_ID}/member`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (memberResponse.status === 404) {
          return Response.redirect("https://nofreethinkers.com/index.html?error=not_in_server", 302);
        }

        const memberData = await memberResponse.json();
        const hasRole = memberData.roles.includes(CONFIG.REQUIRED_ROLE_ID);

        if (!hasRole) {
          return Response.redirect("https://nofreethinkers.com/index.html?error=missing_role", 302);
        }

        // Set Cookie and redirect to frontend
        const response = Response.redirect(CONFIG.FINAL_DESTINATION, 302);
        response.headers.set(
          "Set-Cookie",
          `discord_session=${accessToken}; Path=/; Domain=.nofreethinkers.com; HttpOnly; Secure; Max-Age=604800; SameSite=Lax`
        );
        return response;

      } catch (error) {
        return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
      }
    }

    // ========================================================
    // ROUTE 2: Session Verification (/functions/check-session)
    // ========================================================
    if (url.pathname === "/functions/check-session" || url.pathname === "/check-session") {
      const cookieHeader = request.headers.get("Cookie") || "";
      const match = cookieHeader.match(/discord_session=([^;]+)/);

      if (!match) {
        return new Response(JSON.stringify({ loggedIn: false }), { status: 401, headers: corsHeaders });
      }

      const accessToken = match[1];

      try {
        const userResponse = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userResponse.ok) {
          return new Response(JSON.stringify({ loggedIn: false }), { status: 401, headers: corsHeaders });
        }

        const userData = await userResponse.json();
        return new Response(JSON.stringify({
          loggedIn: true,
          username: userData.global_name || userData.username,
          avatar: userData.avatar,
          id: userData.id
        }), { headers: corsHeaders });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Fallback root page message
    return new Response("NoFreeThinkers Auth Worker is active and healthy!", { status: 200, headers: corsHeaders });
  }
};