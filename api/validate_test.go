// unit — "the small helper … tested on a conforming and a non-conforming
// sample" (Go side), per the api_contract refinement. Mirrors validate.test.js:
// the Go helper passes a conforming sample and rejects a non-conforming one for
// the same representative operations — the create-book request and the
// change-check response.
package apicontract

import "testing"

func mustLoad(t *testing.T) *Contract {
	t.Helper()
	c, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	return c
}

func TestCreateBookRequest(t *testing.T) {
	c := mustLoad(t)

	if err := c.Validate("createBook", Request, "", []byte(`{"title":"Choros para estudo"}`)); err != nil {
		t.Errorf("conforming create-book request was rejected: %v", err)
	}

	bad := map[string]string{
		"empty title":      `{"title":""}`,
		"missing title":    `{}`,
		"unknown property": `{"title":"Ok","secret":"x"}`,
	}
	for name, body := range bad {
		if err := c.Validate("createBook", Request, "", []byte(body)); err == nil {
			t.Errorf("non-conforming create-book request (%s) was accepted", name)
		}
	}
}

func TestChangeCheckResponse(t *testing.T) {
	c := mustLoad(t)

	good := `{"books":[` +
		`{"bookId":"bk_1","status":"changed","head":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},` +
		`{"bookId":"bk_2","status":"gone"},` +
		`{"bookId":"bk_3","status":"unchanged","originalNewSaves":3}` +
		`]}`
	if err := c.Validate("changeCheck", Response, "200", []byte(good)); err != nil {
		t.Errorf("conforming change-check response was rejected: %v", err)
	}

	bad := map[string]string{
		"bad status enum": `{"books":[{"bookId":"bk_1","status":"moved"}]}`,
		"malformed head":  `{"books":[{"bookId":"bk_1","status":"changed","head":"not-a-sha"}]}`,
		"wrong envelope":  `{"changed":[]}`,
	}
	for name, body := range bad {
		if err := c.Validate("changeCheck", Response, "200", []byte(body)); err == nil {
			t.Errorf("non-conforming change-check response (%s) was accepted", name)
		}
	}
}

func TestHelperErrors(t *testing.T) {
	c := mustLoad(t)

	if err := c.Validate("nope", Request, "", []byte(`{}`)); err == nil {
		t.Error("expected an error for an unknown operationId")
	}
	if err := c.Validate("changeCheck", Response, "", []byte(`{}`)); err == nil {
		t.Error("expected an error when no response status is given")
	}
	if err := c.Validate("createBook", Request, "", []byte(`{bad json`)); err == nil {
		t.Error("expected an error for a non-JSON payload")
	}
}
