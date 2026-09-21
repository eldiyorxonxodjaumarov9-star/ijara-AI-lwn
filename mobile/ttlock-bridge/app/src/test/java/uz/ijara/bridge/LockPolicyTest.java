package uz.ijara.bridge;
import org.junit.Test;
import static org.junit.Assert.*;

public class LockPolicyTest {
    @Test public void rejectsOtherLocksAndMalformedIdentity() {
        assertTrue(LockPolicy.sameMac("AA:BB:CC:DD:EE:01", "aa:bb:cc:dd:ee:01"));
        assertFalse(LockPolicy.sameMac("AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02"));
        assertFalse(LockPolicy.sameMac(null, null));
        assertFalse(LockPolicy.sameMac("D10", "D10"));
    }
    @Test public void preservesMinutePrecisionAndRejectsBadWindows() {
        long start = java.time.Instant.parse("2026-09-25T07:01:00Z").toEpochMilli();
        long end = java.time.Instant.parse("2026-09-30T07:00:00Z").toEpochMilli();
        assertTrue(LockPolicy.validWindow(start, end));
        assertFalse(LockPolicy.validWindow(end, start));
        assertFalse(LockPolicy.validWindow(start, start));
    }
    @Test public void rejectsClockDriftBeforeOfflineScheduling() {
        assertTrue(LockPolicy.clockMatches(100000, 110000));
        assertFalse(LockPolicy.clockMatches(100000, 131000));
    }
}
