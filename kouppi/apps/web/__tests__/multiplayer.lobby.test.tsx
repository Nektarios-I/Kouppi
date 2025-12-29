import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the remote store consumed by the page
vi.mock('@/store/remoteGameStore', () => {
  const joinRoom = vi.fn();
  const listRooms = vi.fn();
  const connect = vi.fn();
  const createOrJoinRoom = vi.fn();
  const sendIntent = vi.fn();
  const rooms = [
    { id: 'lobby-1', playerCount: 1, maxPlayers: 2, started: false },
    { id: 'lobby-2', playerCount: 2, maxPlayers: 2, started: true },
  ];
  const state = { phase: 'Lobby', round: { pot: 0 }, players: [] } as any;
  const store = {
    connect,
    joinRoom,
    listRooms,
    createOrJoinRoom,
    sendIntent,
    state,
    connected: true,
    roomId: null,
    playerId: 'you',
    rooms,
  };
  return {
    useRemoteGameStore: () => store,
  };
});

import MultiplayerPage from '@/app/multiplayer/page';

describe('Multiplayer lobby UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows connection status', async () => {
    render(<MultiplayerPage />);
    const status = await screen.findByTestId('conn-status');
    expect(status).toHaveTextContent(/Connected/i);
  });

  it('renders lobby list and join buttons', async () => {
    render(<MultiplayerPage />);
    const rows = await screen.findAllByTestId('lobby-row');
    expect(rows.length).toBeGreaterThan(0);

    const joinButtons = await screen.findAllByRole('button', { name: /Join/i });
    expect(joinButtons.length).toBeGreaterThan(0);
  });

  it('calls joinRoom when clicking Join', async () => {
    const user = userEvent.setup();
    render(<MultiplayerPage />);

    const joinBtn = await screen.findByRole('button', { name: /Join lobby-1/i });
    await user.click(joinBtn);

    const { useRemoteGameStore } = await import('@/store/remoteGameStore');
    const store: any = useRemoteGameStore();
    expect(store.joinRoom).toHaveBeenCalledWith('lobby-1', expect.any(String), expect.any(String));
  });
});
