// unit — "the contract document validates" (Go side), per the api_contract
// refinement. Pins that api/openapi.yaml loads under the Go loader
// (getkin/kin-openapi), validates against OpenAPI 3.1, resolves its $refs, and
// gives every operation an operationId — proving the one document is consumable
// by both languages.
package apicontract

import "testing"

func TestLoadValidatesTheContract(t *testing.T) {
	if _, err := Load(); err != nil {
		t.Fatalf("the contract did not load and validate: %v", err)
	}
}

func TestContractDeclaresOpenAPI31(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if got := c.Document().OpenAPI; got[:4] != "3.1." {
		t.Fatalf("openapi version = %q, want 3.1.x", got)
	}
}

func TestEveryOperationHasAUniqueOperationID(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	doc := c.Document()
	if doc.Paths == nil || doc.Paths.Len() == 0 {
		t.Fatal("the contract declares no paths")
	}
	seen := map[string]string{}
	count := 0
	for path, item := range doc.Paths.Map() {
		for method, op := range item.Operations() {
			if op.OperationID == "" {
				t.Errorf("%s %s is missing an operationId", method, path)
				continue
			}
			if where, dup := seen[op.OperationID]; dup {
				t.Errorf("operationId %q is used by both %s and %s %s", op.OperationID, where, method, path)
			}
			seen[op.OperationID] = method + " " + path
			count++
		}
	}
	if count == 0 {
		t.Fatal("the contract declares no operations")
	}
}

func TestRefsResolve(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	// If loading left a $ref unresolved, the component schema's Value is nil.
	// Spot-check the schemas the representative validator tests rely on.
	for _, name := range []string{"Book", "CreateBookRequest", "ChangeCheckResponse", "Error"} {
		ref := c.Document().Components.Schemas[name]
		if ref == nil || ref.Value == nil {
			t.Errorf("component schema %q did not resolve", name)
		}
	}
}
