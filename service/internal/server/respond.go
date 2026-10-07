package server

import (
	"encoding/json"
	"net/http"
)

// errorBody is the API's Error shape (api/openapi.yaml lines 819–833): a stable
// machine-readable code and a short human message, and nothing else. It never
// carries an email address or a token (DIRECTION §3.3; refinement Constraints),
// so the messages below are fixed, caller-chosen strings.
type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// writeJSON writes v as the JSON body of a response with the given status. A
// late encode error cannot be recovered once the status is written, so it is
// dropped — the metadata-only request log already records the status.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes an Error body with the given status, code and message. The
// message must be safe to show and to log (no address, no token).
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorBody{Code: code, Message: message})
}
