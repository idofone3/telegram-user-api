// worker.js - Deploy on Cloudflare Workers
// Environment variable: BOT_TOKEN

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/api' || url.pathname === '/api/') {
      const user = url.searchParams.get('user') || url.searchParams.get('username') || url.searchParams.get('user_id');
      
      if (!user) {
        return new Response(JSON.stringify({
          error: 'Missing parameter',
          usage: 'GET /api?user=username or /api?user=123456789',
          examples: [`${url.origin}/api?user=durov`, `${url.origin}/api?user=777000`]
        }, null, 2), { status: 400, headers: corsHeaders });
      }

      try {
        const detailedInfo = await getUltraDetailedUserInfo(env.BOT_TOKEN, user);
        return new Response(JSON.stringify(detailedInfo, null, 2), {
          status: 200,
          headers: corsHeaders
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
          stack: error.stack
        }, null, 2), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({
      service: 'Telegram Ultra-Detailed User Info API',
      version: '3.0',
      endpoints: {
        user_info: '/api?user=username',
        by_id: '/api?user=123456789'
      }
    }, null, 2), { headers: corsHeaders });
  }
};

async function getUltraDetailedUserInfo(botToken, userIdentifier) {
  const startTime = Date.now();
  const baseUrl = `https://api.telegram.org/bot${botToken}`;
  
  const result = {
    _query: {
      input: userIdentifier,
      timestamp: new Date().toISOString(),
      timezone: 'UTC'
    },
    _timing: {},
    _api_calls: [],
    user_data: {},
    profile_photos: {},
    additional_data: {},
    _errors: []
  };

  // Prepare chat ID
  let chatId = userIdentifier;
  if (!userIdentifier.toString().startsWith('@') && isNaN(userIdentifier)) {
    chatId = `@${userIdentifier}`;
  }

  // === 1. GET CHAT (PRIMARY USER DATA) ===
  try {
    const t1 = Date.now();
    const chatResponse = await fetch(`${baseUrl}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId })
    });
    
    const chatData = await chatResponse.json();
    result._timing.getChat = `${Date.now() - t1}ms`;
    result._api_calls.push({
      method: 'getChat',
      params: { chat_id: chatId },
      success: chatData.ok,
      response_time_ms: Date.now() - t1
    });

    if (!chatData.ok) {
      throw new Error(`getChat failed: ${chatData.description}`);
    }

    // Store ALL fields from getChat
    result.user_data = {
      // Core identity
      id: chatData.result.id,
      type: chatData.result.type,
      username: chatData.result.username || null,
      first_name: chatData.result.first_name || null,
      last_name: chatData.result.last_name || null,
      is_forum: chatData.result.is_forum || false,
      is_direct_messages: chatData.result.is_direct_messages || false,
      
      // Display customization
      accent_color_id: chatData.result.accent_color_id,
      max_reaction_count: chatData.result.max_reaction_count,
      profile_accent_color_id: chatData.result.profile_accent_color_id || null,
      background_custom_emoji_id: chatData.result.background_custom_emoji_id || null,
      profile_background_custom_emoji_id: chatData.result.profile_background_custom_emoji_id || null,
      
      // Emoji status
      emoji_status: chatData.result.emoji_status_custom_emoji_id ? {
        custom_emoji_id: chatData.result.emoji_status_custom_emoji_id,
        expiration_date: chatData.result.emoji_status_expiration_date || null,
        expiration_date_human: chatData.result.emoji_status_expiration_date 
          ? new Date(chatData.result.emoji_status_expiration_date * 1000).toISOString()
          : null,
        is_expired: chatData.result.emoji_status_expiration_date 
          ? (Date.now() / 1000) > chatData.result.emoji_status_expiration_date
          : null
      } : null,
      
      // Profile photo
      photo: chatData.result.photo ? {
        small_file_id: chatData.result.photo.small_file_id,
        small_file_unique_id: chatData.result.photo.small_file_unique_id,
        big_file_id: chatData.result.photo.big_file_id,
        big_file_unique_id: chatData.result.photo.big_file_unique_id
      } : null,
      
      // All usernames
      active_usernames: chatData.result.active_usernames || [],
      
      // Personal information
      birthdate: chatData.result.birthdate ? {
        day: chatData.result.birthdate.day,
        month: chatData.result.birthdate.month,
        year: chatData.result.birthdate.year || null,
        formatted: `${chatData.result.birthdate.day}/${chatData.result.birthdate.month}${chatData.result.birthdate.year ? '/' + chatData.result.birthdate.year : ''}`,
        zodiac: getZodiacSign(chatData.result.birthdate.day, chatData.result.birthdate.month)
      } : null,
      
      bio: chatData.result.bio || null,
      
      // Business account data
      business_intro: chatData.result.business_intro ? {
        title: chatData.result.business_intro.title || null,
        message: chatData.result.business_intro.message || null,
        sticker: chatData.result.business_intro.sticker || null
      } : null,
      
      business_location: chatData.result.business_location ? {
        address: chatData.result.business_location.address
      } : null,
      
      business_opening_hours: chatData.result.business_opening_hours ? {
        time_zone_name: chatData.result.business_opening_hours.time_zone_name,
        opening_hours: chatData.result.business_opening_hours.opening_hours.map(h => ({
          opening_minute: h.opening_minute,
          closing_minute: h.closing_minute,
          opening_time: minutesToTime(h.opening_minute),
          closing_time: minutesToTime(h.closing_minute),
          duration_minutes: h.closing_minute - h.opening_minute
        }))
      } : null,
      
      // Personal channel
      personal_chat: chatData.result.personal_chat ? {
        id: chatData.result.personal_chat.id,
        type: chatData.result.personal_chat.type,
        title: chatData.result.personal_chat.title || null,
        username: chatData.result.personal_chat.username || null
      } : null,
      
      // Parent chat (for direct messages)
      parent_chat: chatData.result.parent_chat || null,
      
      // Reactions
      available_reactions: chatData.result.available_reactions || [],
      
      // Gift types
      accepted_gift_types: chatData.result.accepted_gift_types || null,
      
      // Privacy settings
      has_private_forwards: chatData.result.has_private_forwards || false,
      has_restricted_voice_and_video_messages: chatData.result.has_restricted_voice_and_video_messages || false,
      
      // Additional fields for groups/channels (if applicable)
      title: chatData.result.title || null,
      description: chatData.result.description || null,
      invite_link: chatData.result.invite_link || null,
      pinned_message: chatData.result.pinned_message || null,
      permissions: chatData.result.permissions || null,
      slow_mode_delay: chatData.result.slow_mode_delay || null,
      message_auto_delete_time: chatData.result.message_auto_delete_time || null,
      has_aggressive_anti_spam_enabled: chatData.result.has_aggressive_anti_spam_enabled || false,
      has_hidden_members: chatData.result.has_hidden_members || false,
      has_protected_content: chatData.result.has_protected_content || false,
      has_visible_history: chatData.result.has_visible_history || null,
      linked_chat_id: chatData.result.linked_chat_id || null,
      location: chatData.result.location || null
    };

  } catch (error) {
    result._errors.push({
      method: 'getChat',
      error: error.message
    });
    throw error;
  }

  // === 2. GET USER PROFILE PHOTOS ===
  try {
    const t2 = Date.now();
    const photosResponse = await fetch(`${baseUrl}/getUserProfilePhotos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: result.user_data.id,
        offset: 0,
        limit: 100
      })
    });

    const photosData = await photosResponse.json();
    result._timing.getUserProfilePhotos = `${Date.now() - t2}ms`;
    result._api_calls.push({
      method: 'getUserProfilePhotos',
      params: { user_id: result.user_data.id, limit: 100 },
      success: photosData.ok,
      response_time_ms: Date.now() - t2
    });

    if (photosData.ok) {
      result.profile_photos = {
        total_count: photosData.result.total_count,
        fetched_count: photosData.result.photos.length,
        photos: []
      };

      // Get detailed info for each photo
      for (let i = 0; i < photosData.result.photos.length; i++) {
        const photoArray = photosData.result.photos[i];
        const photoDetails = {
          photo_index: i,
          sizes: []
        };

        // Process all sizes (thumbnail, small, medium, large)
        for (const photo of photoArray) {
          const photoSize = {
            file_id: photo.file_id,
            file_unique_id: photo.file_unique_id,
            width: photo.width,
            height: photo.height,
            file_size: photo.file_size,
            size_category: getSizeCategory(photo.width)
          };

          // Get file path for download URL
          try {
            const fileResponse = await fetch(`${baseUrl}/getFile`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_id: photo.file_id })
            });

            const fileData = await fileResponse.json();
            if (fileData.ok) {
              photoSize.file_path = fileData.result.file_path;
              photoSize.download_url = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
            }
          } catch (e) {
            photoSize.file_error = e.message;
          }

          photoDetails.sizes.push(photoSize);
        }

        result.profile_photos.photos.push(photoDetails);
      }
    }
  } catch (error) {
    result._errors.push({
      method: 'getUserProfilePhotos',
      error: error.message
    });
  }

  // === 3. ATTEMPT TO GET CHAT MEMBER INFO (requires common chat) ===
  try {
    const t3 = Date.now();
    const memberResponse = await fetch(`${baseUrl}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: result.user_data.id,
        user_id: result.user_data.id
      })
    });

    const memberData = await memberResponse.json();
    result._timing.getChatMember = `${Date.now() - t3}ms`;
    result._api_calls.push({
      method: 'getChatMember',
      params: { chat_id: result.user_data.id, user_id: result.user_data.id },
      success: memberData.ok,
      response_time_ms: Date.now() - t3
    });

    if (memberData.ok) {
      result.additional_data.chat_member = {
        status: memberData.result.status,
        user: memberData.result.user,
        is_member: memberData.result.is_member || null,
        can_be_edited: memberData.result.can_be_edited || null,
        can_manage_chat: memberData.result.can_manage_chat || null,
        can_change_info: memberData.result.can_change_info || null,
        can_delete_messages: memberData.result.can_delete_messages || null,
        can_invite_users: memberData.result.can_invite_users || null,
        can_restrict_members: memberData.result.can_restrict_members || null,
        can_pin_messages: memberData.result.can_pin_messages || null,
        can_promote_members: memberData.result.can_promote_members || null,
        is_anonymous: memberData.result.is_anonymous || null,
        custom_title: memberData.result.custom_title || null
      };
    }
  } catch (error) {
    result._errors.push({
      method: 'getChatMember',
      error: error.message,
      note: 'This method requires bot and user to share a common chat'
    });
  }

  // === 4. GET FILE INFO FOR CURRENT PROFILE PHOTO ===
  if (result.user_data.photo) {
    try {
      const t4 = Date.now();
      const smallFileResponse = await fetch(`${baseUrl}/getFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: result.user_data.photo.small_file_id })
      });
      
      const bigFileResponse = await fetch(`${baseUrl}/getFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: result.user_data.photo.big_file_id })
      });

      const smallFileData = await smallFileResponse.json();
      const bigFileData = await bigFileResponse.json();
      
      result._timing.getFile_currentPhoto = `${Date.now() - t4}ms`;

      if (smallFileData.ok) {
        result.user_data.photo.small_file_path = smallFileData.result.file_path;
        result.user_data.photo.small_download_url = `https://api.telegram.org/file/bot${botToken}/${smallFileData.result.file_path}`;
        result.user_data.photo.small_file_size = smallFileData.result.file_size;
      }
      
      if (bigFileData.ok) {
        result.user_data.photo.big_file_path = bigFileData.result.file_path;
        result.user_data.photo.big_download_url = `https://api.telegram.org/file/bot${botToken}/${bigFileData.result.file_path}`;
        result.user_data.photo.big_file_size = bigFileData.result.file_size;
      }
    } catch (error) {
      result._errors.push({
        method: 'getFile (current photo)',
        error: error.message
      });
    }
  }

  // === 5. ATTEMPT getUserChatBoosts ===
  try {
    const t5 = Date.now();
    // This only works if we have a chat_id to check boosts for
    // We'll skip this as it requires a specific chat context
    result._timing.getUserChatBoosts = 'skipped - requires chat_id parameter';
  } catch (error) {
    result._errors.push({
      method: 'getUserChatBoosts',
      error: error.message
    });
  }

  // === METADATA & ANALYSIS ===
  result._metadata = {
    api_version: 'Telegram Bot API 7.11',
    fetch_timestamp: new Date().toISOString(),
    fetch_timestamp_unix: Math.floor(Date.now() / 1000),
    total_execution_time_ms: Date.now() - startTime,
    query_details: {
      input_value: userIdentifier,
      resolved_chat_id: chatId,
      query_type: isNaN(userIdentifier) ? 'username' : 'user_id',
      is_bot_username: userIdentifier.toString().toLowerCase().endsWith('bot')
    },
    api_calls_summary: {
      total_calls: result._api_calls.length,
      successful_calls: result._api_calls.filter(c => c.success).length,
      failed_calls: result._api_calls.filter(c => !c.success).length
    },
    user_analysis: {
      has_username: !!result.user_data.username,
      has_multiple_usernames: (result.user_data.active_usernames || []).length > 1,
      has_profile_photo: !!result.user_data.photo,
      has_bio: !!result.user_data.bio,
      has_birthdate: !!result.user_data.birthdate,
      is_business_account: !!(result.user_data.business_intro || result.user_data.business_location || result.user_data.business_opening_hours),
      has_personal_channel: !!result.user_data.personal_chat,
      has_emoji_status: !!result.user_data.emoji_status,
      total_profile_photos: result.profile_photos.total_count || 0,
      privacy_settings: {
        forwards_restricted: result.user_data.has_private_forwards,
        voice_video_restricted: result.user_data.has_restricted_voice_and_video_messages
      }
    },
    limitations: [
      'Some fields require user interaction with bot first',
      'getUserChatBoosts requires shared chat context',
      'getChatMember requires common chat membership',
      'MTProto API provides more data but requires user authentication'
    ]
  };

  // === FORMATTING HELPERS ===
  result._formatted_display = {
    full_name: [result.user_data.first_name, result.user_data.last_name].filter(Boolean).join(' '),
    display_name: result.user_data.username ? `@${result.user_data.username}` : result.user_data.first_name,
    profile_url: result.user_data.username ? `https://t.me/${result.user_data.username}` : null,
    tg_user_link: `tg://user?id=${result.user_data.id}`,
    age: result.user_data.birthdate && result.user_data.birthdate.year 
      ? new Date().getFullYear() - result.user_data.birthdate.year 
      : null
  };

  return result;
}

// === UTILITY FUNCTIONS ===

function getZodiacSign(day, month) {
  const signs = [
    { sign: 'Capricorn', start: [12, 22], end: [1, 19] },
    { sign: 'Aquarius', start: [1, 20], end: [2, 18] },
    { sign: 'Pisces', start: [2, 19], end: [3, 20] },
    { sign: 'Aries', start: [3, 21], end: [4, 19] },
    { sign: 'Taurus', start: [4, 20], end: [5, 20] },
    { sign: 'Gemini', start: [5, 21], end: [6, 20] },
    { sign: 'Cancer', start: [6, 21], end: [7, 22] },
    { sign: 'Leo', start: [7, 23], end: [8, 22] },
    { sign: 'Virgo', start: [8, 23], end: [9, 22] },
    { sign: 'Libra', start: [9, 23], end: [10, 22] },
    { sign: 'Scorpio', start: [10, 23], end: [11, 21] },
    { sign: 'Sagittarius', start: [11, 22], end: [12, 21] }
  ];
  
  for (const { sign, start, end } of signs) {
    if ((month === start[0] && day >= start[1]) || (month === end[0] && day <= end[1])) {
      return sign;
    }
  }
  return 'Unknown';
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function getSizeCategory(width) {
  if (width <= 160) return 'thumbnail';
  if (width <= 320) return 'small';
  if (width <= 640) return 'medium';
  return 'large';
}
