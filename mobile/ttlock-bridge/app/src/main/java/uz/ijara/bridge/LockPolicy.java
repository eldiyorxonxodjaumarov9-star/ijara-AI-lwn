package uz.ijara.bridge;

final class LockPolicy {
    static boolean sameMac(String expected, String actual) {
        return expected != null && expected.matches("(?i)([0-9a-f]{2}:){5}[0-9a-f]{2}")
            && actual != null && expected.equalsIgnoreCase(actual);
    }
    static boolean validWindow(long start, long end) { return start > 0 && end > start; }
    static boolean clockMatches(long lockTime, long serverTime) {
        return Math.abs(lockTime - serverTime) <= 30000;
    }
}
