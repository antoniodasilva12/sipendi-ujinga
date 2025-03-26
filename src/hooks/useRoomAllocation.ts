import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

interface Room {
  id: number;
  room_number: string;
  floor: number;
  capacity: number;
  type: string;
  price_per_month: number;
}

interface RoomAllocation {
  id: string | number;
  room: Room;
  start_date: string;
  end_date: string | null;
  student_id?: string;
  room_id?: number;
}

interface BookingRequestResponse {
  id: string;
  request_date: string;
  status: 'pending' | 'approved' | 'rejected';
  room: Room;
}

export const useRoomAllocation = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomAllocation, setRoomAllocation] = useState<RoomAllocation | null>(null);
  const [hasPendingBooking, setHasPendingBooking] = useState(false);

  const fetchRoomStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First check for approved booking request
      const { data: approvedBooking, error: approvedError } = await supabase
        .from('booking_requests')
        .select(`
          id,
          request_date,
          status,
          room:rooms!inner (
            id,
            room_number,
            floor,
            capacity,
            price_per_month,
            type
          )
        `)
        .eq('student_id', user.id)
        .eq('status', 'approved')
        .order('request_date', { ascending: false })
        .single();

      if (approvedError && approvedError.code !== 'PGRST116') {
        throw approvedError;
      }

      if (approvedBooking) {
        const bookingData = approvedBooking as unknown as BookingRequestResponse;
        setRoomAllocation({
          id: bookingData.id,
          room: bookingData.room,
          start_date: bookingData.request_date,
          end_date: null,
          student_id: user.id,
          room_id: bookingData.room.id
        } as RoomAllocation);
        setHasPendingBooking(false);
        return;
      }

      // If no approved booking, check for pending booking requests
      const { data: pendingBooking, error: pendingError } = await supabase
        .from('booking_requests')
        .select(`
          id,
          request_date,
          status,
          room:rooms!inner (
            id,
            room_number,
            floor,
            capacity,
            price_per_month,
            type
          )
        `)
        .eq('student_id', user.id)
        .eq('status', 'pending')
        .single();

      if (pendingError && pendingError.code !== 'PGRST116') {
        throw pendingError;
      }

      if (pendingBooking) {
        setHasPendingBooking(true);
      } else {
        setHasPendingBooking(false);
      }

      setRoomAllocation(null);
    } catch (err) {
      console.error('Error fetching room status:', err);
      setError('Failed to fetch room status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomStatus();
  }, []);

  return {
    loading,
    error,
    roomAllocation,
    hasPendingBooking,
    refreshAllocation: fetchRoomStatus
  };
}; 