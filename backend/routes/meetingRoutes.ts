import express from 'express';
import { 
  createMeeting, 
  joinMeeting, 
  getMeetingHistory, 
  getMeetingMessages, 
  getMeetingAISummary,
  scheduleMeeting,
  deleteMeeting,
  updateMessage,
  deleteMessage,
  reactToMessage,
  askAI,
  getMeetingByCode,
  getHostMeetings,
  getLiveBroadcasts,
  sendMeetingReminder
} from '../controllers/meetingController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/create', protect, createMeeting);
router.post('/schedule', protect, scheduleMeeting);
router.post('/send-reminder', protect, sendMeetingReminder);
router.get('/broadcasts', protect, getLiveBroadcasts);
router.get('/join', protect, getMeetingByCode);
router.post('/join', protect, joinMeeting);
router.get('/history', protect, getMeetingHistory);
router.get('/host-meetings', protect, getHostMeetings);
router.delete('/:id', protect, deleteMeeting);
router.get('/:code/messages', protect, getMeetingMessages);
router.post('/:code/ai-summary', protect, getMeetingAISummary);

router.put('/messages/:id', protect, updateMessage);
router.delete('/messages/:id', protect, deleteMessage);
router.post('/messages/:id/react', protect, reactToMessage);
router.post('/ask-ai', protect, askAI);

export default router;
