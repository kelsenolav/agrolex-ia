import { canUseTrial, markTrialUsed, getTrialStatus, trackTrialEvent } from '../trialControl';

// Mock variables for test setup
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();

const mockSupabaseAdmin = {
  from: jest.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseAdmin,
}));

describe('Trial Control Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
  });

  describe('getTrialStatus', () => {
    it('returns used false if lead does not exist', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null });
      const status = await getTrialStatus('user-123', 'test@example.com');
      expect(status).toEqual({
        isTrial: true,
        used: false,
        analysisId: null,
      });
    });

    it('returns used true if trial_used is true', async () => {
      mockMaybeSingle.mockResolvedValue({ data: { trial_used: true, trial_analysis_id: 'analysis-123' } });
      const status = await getTrialStatus('user-123');
      expect(status).toEqual({
        isTrial: true,
        used: true,
        analysisId: 'analysis-123',
      });
    });

    it('returns used true if trial_utilizado is true', async () => {
      mockMaybeSingle.mockResolvedValue({ data: { trial_utilizado: true, trial_analysis_id: 'analysis-123' } });
      const status = await getTrialStatus('user-123');
      expect(status).toEqual({
        isTrial: true,
        used: true,
        analysisId: 'analysis-123',
      });
    });
  });

  describe('canUseTrial', () => {
    it('returns true if trial has not been used', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null });
      const allowed = await canUseTrial('user-123');
      expect(allowed).toBe(true);
    });

    it('returns false if trial has already been used', async () => {
      mockMaybeSingle.mockResolvedValue({ data: { trial_used: true } });
      const allowed = await canUseTrial('user-123');
      expect(allowed).toBe(false);
    });
  });

  describe('markTrialUsed', () => {
    it('creates a new lead with trial marked used if lead does not exist', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null });
      mockInsert.mockResolvedValue({ error: null });
      
      const success = await markTrialUsed('user-123', 'analysis-123', 'test@example.com');
      expect(success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          email: 'test@example.com',
          trial_used: true,
          trial_analysis_id: 'analysis-123',
          trial_utilizado: true,
        })
      );
    });

    it('updates existing lead if it exists', async () => {
      mockMaybeSingle.mockResolvedValue({ data: { id: 'lead-123', email: 'test@example.com' } });
      const mockEqUpdate = jest.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: mockEqUpdate });

      const success = await markTrialUsed('user-123', 'analysis-123');
      expect(success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          trial_used: true,
          trial_analysis_id: 'analysis-123',
          trial_utilizado: true,
        })
      );
      expect(mockEqUpdate).toHaveBeenCalledWith('id', 'lead-123');
    });
  });

  describe('trackTrialEvent', () => {
    it('appends new event to existing commercial events metadata', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'lead-123',
          metadata: {
            commercial_events: [
              { type: 'some_event', timestamp: '2026-06-07T00:00:00Z' }
            ]
          }
        }
      });
      const mockEqUpdate = jest.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: mockEqUpdate });

      const success = await trackTrialEvent('user-123', 'test_event', { key: 'value' });
      expect(success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            commercial_events: expect.arrayContaining([
              expect.objectContaining({ type: 'some_event' }),
              expect.objectContaining({ type: 'test_event', meta: { key: 'value' } })
            ])
          })
        })
      );
    });
  });
});
