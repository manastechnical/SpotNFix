import supabase from "../supabaseClient.js";

// This function will hold the connection open and forward Supabase updates.
export const communityUpdates = (req, res) => {
    const { id } = req.params;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const channel = supabase
        .channel(`community_updates:${id}`)
        .on('postgres_changes', {
            event: '*', // Listen for INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'community_members',
            filter: `community_id=eq.${id}`
        }, (payload) => {
            // When a change is detected, send a simple message to the client.
            // The client doesn't need the payload, just the notification to refresh.
            res.write(`data: ${JSON.stringify({ update: true })}\n\n`);
        })
        .subscribe();

    // When the client closes the connection, we clean up the channel.
    req.on('close', () => {
        supabase.removeChannel(channel);
    });
};

export const createCommunity = async (req, res) => {
    const { name, description, created_by } = req.body;

    if (!name || !created_by) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        // Step 1: Create the community in the 'communities' table.
        const { data: newCommunity, error: communityError } = await supabase
            .from("communities")
            .insert([{ name, description, created_by }])
            .select()
            .single();

        if (communityError) throw communityError;

        // Step 2: Automatically add the creator as the first member with the 'admin' role.
        const { error: memberError } = await supabase
            .from("community_members")
            .insert([{ community_id: newCommunity.id, user_id: created_by, role: 'admin' }]);

        if (memberError) throw memberError;

        res.status(201).json({ success: true, data: newCommunity });
    } catch (error) {
        console.error("Error creating community:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Fetches all communities with an accurate count of their members.
export const getCommunities = async (req, res) => {
    try {
        const { data: communities, error } = await supabase
            .from('communities')
            .select(`
                id, name, description,
                community_members ( count )
            `);
  
      if (error) throw error;
      res.status(200).json({ success: true, data: communities });
    } catch (error) {
      console.error("Error getting communities:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Fetches a single community with detailed member info, including their roles.
export const getCommunityById = async (req, res) => {
    const { id } = req.params;
    try {
        const { data: community, error } = await supabase
            .from('communities')
            .select(`
                *,
                members:community_members (
                    role,
                    user:users ( id, name, email )
                ),
                events ( * )
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ message: "Community not found" });
            throw error;
        }
        res.status(200).json({ success: true, data: community });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// --- NEW MANAGEMENT FUNCTIONS ---

export const removeMember = async (req, res) => {
    const { communityId, memberId } = req.params;
    try {
        const { error } = await supabase
            .from('community_members')
            .delete()
            .eq('community_id', communityId)
            .eq('user_id', memberId);

        if (error) throw error;
        res.status(200).json({ success: true, message: "Member removed" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to remove member" });
    }
};

export const updateMemberRole = async (req, res) => {
    const { communityId, memberId } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: "Role is required" });
    
    try {
        const { error } = await supabase
            .from('community_members')
            .update({ role })
            .eq('community_id', communityId)
            .eq('user_id', memberId);

        if (error) throw error;
        res.status(200).json({ success: true, message: "Member role updated" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update role" });
    }
};

export const joinCommunity = async (req, res) => {
  const { communityId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const { data, error } = await supabase
      .from("community_members")
      .insert([{ community_id: communityId, user_id: userId }]);

    if (error) throw error;

    res.status(200).json({ success: true, message: "Joined community" });
  } catch (error) {
    console.error("Error joining community:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const leaveCommunity = async (req, res) => {
    const { communityId } = req.params;
    const { userId } = req.body;

    try {
        // Get all members of the community
        const { data: members, error: memberFetchError } = await supabase
            .from('community_members')
            .select('*')
            .eq('community_id', communityId);
        if (memberFetchError) throw memberFetchError;

        // Case 1: The last member is leaving.
        if (members.length === 1 && members[0].user_id === userId) {
            // Delete the entire community
            await supabase.from('communities').delete().eq('id', communityId);
            return res.status(200).json({ success: true, message: "Community deleted as last member left." });
        }

        const leavingMember = members.find(m => m.user_id === userId);
        const isAdmin = leavingMember.role === 'admin';
        const otherAdmins = members.filter(m => m.role === 'admin' && m.user_id !== userId);

        // Case 2: The last admin is leaving, but others remain.
        if (isAdmin && otherAdmins.length === 0) {
            // Find the longest-serving member to promote
            const remainingMembers = members.filter(m => m.user_id !== userId);
            remainingMembers.sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));
            const newAdmin = remainingMembers[0];

            // Promote the new admin
            await supabase.from('community_members').update({ role: 'admin' }).eq('user_id', newAdmin.user_id).eq('community_id', communityId);
        }
        
        // Finally, remove the leaving member
        await supabase.from('community_members').delete().eq('user_id', userId).eq('community_id', communityId);
        res.status(200).json({ success: true, message: "Successfully left the community." });

    } catch (error) {
        console.error("Leave community error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


// --- NEW ADMIN MANAGEMENT FUNCTIONS ---
export const updateCommunity = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        const { error } = await supabase.from('communities').update({ name, description }).eq('id', id);
        if (error) throw error;
        res.status(200).json({ success: true, message: "Community updated" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update community" });
    }
};

export const deleteCommunity = async (req, res) => {
    const { id } = req.params;
    console.log('hi',id)
    try {
        // Step 1: Delete all events for the community (if any)
        await supabase.from('events').delete().eq('community_id', id);
        
        // Step 2: Delete all members of the community
        await supabase.from('community_members').delete().eq('community_id', id);

        // Step 3: Now it's safe to delete the community itself
        await supabase.from('communities').delete().eq('id', id);
        
        res.status(200).json({ success: true, message: "Community and all associated data deleted" });
    } catch (error) {
        console.error("Delete community error:", error);
        res.status(500).json({ success: false, message: "Failed to delete community" });
    }
};

export const createEvent = async (req, res) => {
    const { communityId } = req.params;
    const { title, description, event_date, created_by } = req.body;

    if (!title || !event_date || !created_by) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const { data: newEvent, error } = await supabase
            .from("events")
            .insert([{ community_id: communityId, title, description, event_date, created_by }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data: newEvent });
    } catch (error) {
        console.error("Error creating event:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getCommunityEvents = async (req, res) => {
    const { communityId } = req.params;

    try {
        const { data: events, error } = await supabase
            .from("events")
            .select("*")
            .eq("community_id", communityId);

        if (error) throw error;

        res.status(200).json({ success: true, data: events });
    } catch (error) {
        console.error("Error getting community events:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}