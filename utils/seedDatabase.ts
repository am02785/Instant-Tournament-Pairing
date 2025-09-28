// Updated to use API route instead of direct Firebase access

export async function seedDatabase(playerCount: number = 15): Promise<{ success: boolean; message?: string; error?: string; tournamentId?: string }> {
  try {
    const response = await fetch('/api/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playerCount }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error seeding database:', error);
    return {
      success: false,
      error: 'Network error occurred while seeding database'
    };
  }
}