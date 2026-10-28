import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '../test/render.jsx';
import { fetchAudioTranscript, fetchLessonAudio } from '../utils/api.js';
import AudioExplainer from './AudioExplainer.jsx';

vi.mock('../utils/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchLessonAudio: vi.fn(),
  fetchAudioTranscript: vi.fn(),
}));

const lesson = { id: 'lesson-1', title: 'The useEffect Hook Basics' };
const wavBlob = new Blob(['RIFF....WAVE'], { type: 'audio/wav' });

beforeEach(() => {
  fetchLessonAudio.mockReset();
  fetchAudioTranscript.mockReset();
  // jsdom has no object URLs.
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:audio-1') }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AudioExplainer', () => {
  it('does nothing until the button is clicked (creating audio costs AI calls)', () => {
    renderWithQuery(<AudioExplainer lesson={lesson} />);

    expect(screen.getByRole('button', { name: 'Explain in Hinglish' })).toBeInTheDocument();
    expect(fetchLessonAudio).not.toHaveBeenCalled();
  });

  it('shows progress while the audio is being created, then a player and download link', async () => {
    const user = userEvent.setup();
    let resolveAudio;
    fetchLessonAudio.mockReturnValue(new Promise((resolve) => (resolveAudio = resolve)));
    const { container } = renderWithQuery(<AudioExplainer lesson={lesson} />);

    await user.click(screen.getByRole('button', { name: 'Explain in Hinglish' }));

    expect(fetchLessonAudio).toHaveBeenCalledWith('lesson-1');
    expect(screen.getByRole('button', { name: /preparing audio/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/Writing and recording a Hinglish/);

    resolveAudio(wavBlob);
    const player = await screen.findByLabelText(
      'Hinglish explanation of The useEffect Hook Basics',
    );
    expect(player).toHaveAttribute('src', 'blob:audio-1');
    expect(container.querySelector('audio')).toHaveAttribute('controls');
    expect(screen.getByRole('link', { name: /download audio/i })).toHaveAttribute(
      'download',
      'text-to-learn-the-useeffect-hook-basics-hinglish.wav',
    );
    expect(screen.queryByRole('button', { name: 'Explain in Hinglish' })).toBeNull();
  });

  it('shows the transcript on request', async () => {
    const user = userEvent.setup();
    fetchLessonAudio.mockResolvedValue(wavBlob);
    fetchAudioTranscript.mockResolvedValue({
      language: 'hinglish',
      script: 'Namaste! Aaj hum useEffect seekhenge.',
      durationSec: 95,
    });
    renderWithQuery(<AudioExplainer lesson={lesson} />);

    await user.click(screen.getByRole('button', { name: 'Explain in Hinglish' }));
    await user.click(await screen.findByRole('button', { name: /show transcript/i }));

    expect(await screen.findByText('Namaste! Aaj hum useEffect seekhenge.')).toBeInTheDocument();
    expect(fetchAudioTranscript).toHaveBeenCalledWith('lesson-1');
    expect(screen.getByRole('button', { name: /hide transcript/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it("shows the server's error and lets the user retry", async () => {
    const user = userEvent.setup();
    fetchLessonAudio
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'The audio service is busy right now.' } } },
      })
      .mockResolvedValueOnce(wavBlob);
    renderWithQuery(<AudioExplainer lesson={lesson} />);

    await user.click(screen.getByRole('button', { name: 'Explain in Hinglish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The audio service is busy right now.',
    );

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText(/Hinglish explanation of/)).toBeInTheDocument();
    expect(fetchLessonAudio).toHaveBeenCalledTimes(2);
  });
});
