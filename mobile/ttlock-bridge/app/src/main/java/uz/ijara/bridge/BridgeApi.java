package uz.ijara.bridge;

import org.json.JSONObject;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import javax.net.ssl.HttpsURLConnection;

/** No cookies, cache, disk persistence, redirects, interceptors, or body logging. */
final class BridgeApi {
    private final String origin;
    String bearer;
    String sessionToken;

    BridgeApi(String origin) {
        URI uri = URI.create(origin);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                || uri.getQuery() != null || uri.getFragment() != null
                || !(uri.getPath().isEmpty() || uri.getPath().equals("/"))) {
            throw new IllegalArgumentException("HTTPS origin required");
        }
        this.origin = origin.replaceAll("/$", "");
    }

    JSONObject post(String path, JSONObject body) throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) URI.create(origin + path).toURL().openConnection();
        connection.setRequestMethod("POST");
        connection.setInstanceFollowRedirects(false);
        connection.setUseCaches(false);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(25000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Cache-Control", "no-store");
        if (bearer != null) connection.setRequestProperty("Authorization", "Bearer " + bearer);
        if (sessionToken != null) connection.setRequestProperty("x-ttlock-bluetooth-session-token", sessionToken);
        byte[] request = body.toString().getBytes(StandardCharsets.UTF_8);
        try {
            try (java.io.OutputStream out = connection.getOutputStream()) { out.write(request); }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new Exception("HTTP_" + status);
            try (java.io.InputStream in = connection.getInputStream(); java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    if (out.size() + read > 1024 * 1024) throw new Exception("RESPONSE_TOO_LARGE");
                    out.write(buffer, 0, read);
                }
                return new JSONObject(out.toString("UTF-8")).getJSONObject("data");
            }
        } finally {
            java.util.Arrays.fill(request, (byte) 0);
            body.remove("password");
            connection.disconnect();
        }
    }

    void clear() { bearer = null; sessionToken = null; }
}
