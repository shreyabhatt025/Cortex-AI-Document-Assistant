// routes/chatRoutes.js
//
// Everything to do with saved chat sessions: listing them in the
// sidebar, creating new ones, renaming, pinning, deleting, and turning
// sharing on/off.
//
// All routes in this file are protected by authMiddleware (mounted in
// server.js as: app.use('/chats', authMiddleware, chatRoutes)).
// The one exception — actually VIEWING a shared chat — is NOT in this
// file. That's a public, unauthenticated route and lives directly in
// server.js as GET /shared/:shareId, since it has no business being
// behind the same auth wall as everything else here.

const express = require('express')
const crypto  = require('crypto')
const router  = express.Router()

const {
  listChats,
  createChat,
  getChat,
  updateChat,
  deleteChat,
} = require('../db')


// GET /chats
// Returns this user's chats for the sidebar. Pinned chats first, then
// most recently active. Doesn't include message bodies — just enough
// to render the list — so this stays fast as chat count grows.
router.get('/', async (req, res) => {
  try {
    const chats = await listChats(req.user.userId)
    res.json({ chats })
  } catch (error) {
    console.log('error listing chats:', error.message)
    res.status(500).json({ error: 'could not load chats', details: error.message })
  }
})


// POST /chats
// Creates a new, empty chat. Body can optionally include a title
// (e.g. the frontend can pass the first question as a starting
// title); otherwise it defaults to "New chat".
router.post('/', async (req, res) => {
  try {
    const chat = await createChat(req.user.userId, req.body?.title)
    res.status(201).json({ chat })
  } catch (error) {
    console.log('error creating chat:', error.message)
    res.status(500).json({ error: 'could not create chat', details: error.message })
  }
})


// GET /chats/:id
// Returns one chat with its full message history. Scoped to
// req.user.userId — if this id belongs to someone else, getChat()
// returns null and we 404 rather than leaking that the chat exists.
router.get('/:id', async (req, res) => {
  try {
    const chat = await getChat(req.params.id, req.user.userId)
    if (!chat) {
      return res.status(404).json({ error: 'chat not found' })
    }
    res.json({ chat })
  } catch (error) {
    console.log('error loading chat:', error.message)
    res.status(500).json({ error: 'could not load chat', details: error.message })
  }
})


// PUT /chats/:id
// Renames and/or pins/unpins a chat.
// body: { title?: string, pinned?: boolean }
// Only fields actually present in the body get updated — sending
// { pinned: true } alone won't touch the title, and vice versa.
router.put('/:id', async (req, res) => {
  try {
    const { title, pinned } = req.body || {}
    const updates = {}

    if (typeof title === 'string' && title.trim().length > 0) {
      updates.title = title.trim().slice(0, 80) // keep sidebar labels sane
    }
    if (typeof pinned === 'boolean') {
      updates.pinned = pinned
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'nothing to update — send title and/or pinned' })
    }

    const chat = await updateChat(req.params.id, req.user.userId, updates)
    if (!chat) {
      return res.status(404).json({ error: 'chat not found' })
    }
    res.json({ chat })
  } catch (error) {
    console.log('error updating chat:', error.message)
    res.status(500).json({ error: 'could not update chat', details: error.message })
  }
})


// DELETE /chats/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteChat(req.params.id, req.user.userId)
    if (!deleted) {
      return res.status(404).json({ error: 'chat not found' })
    }
    res.json({ message: 'chat deleted' })
  } catch (error) {
    console.log('error deleting chat:', error.message)
    res.status(500).json({ error: 'could not delete chat', details: error.message })
  }
})


// POST /chats/:id/share
// Turns on public sharing for this chat. Generates a random,
// url-safe share id and stamps it on the chat document. Anyone with
// the resulting link (GET /shared/:shareId, no login required) can
// view the conversation read-only.
router.post('/:id/share', async (req, res) => {
  try {
    // 9 random bytes → 12 base64url characters. Not guessable,
    // short enough to put in a URL without it looking absurd.
    const shareId = crypto.randomBytes(9).toString('base64url')

    const chat = await updateChat(req.params.id, req.user.userId, { shareId })
    if (!chat) {
      return res.status(404).json({ error: 'chat not found' })
    }
    res.json({ shareId })
  } catch (error) {
    console.log('error creating share link:', error.message)
    res.status(500).json({ error: 'could not create share link', details: error.message })
  }
})


// DELETE /chats/:id/share
// Turns sharing back off. The old link stops working immediately —
// GET /shared/:shareId won't find a match once shareId is cleared.
router.delete('/:id/share', async (req, res) => {
  try {
    const chat = await updateChat(req.params.id, req.user.userId, { shareId: null })
    if (!chat) {
      return res.status(404).json({ error: 'chat not found' })
    }
    res.json({ message: 'sharing disabled' })
  } catch (error) {
    console.log('error disabling share link:', error.message)
    res.status(500).json({ error: 'could not disable sharing', details: error.message })
  }
})


module.exports = router