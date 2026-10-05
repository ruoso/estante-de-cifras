// Package apicontract is a thin validator over the Estante de Cifras API
// contract (openapi.yaml), for the service's (Go) tests. The app and the
// service share no code (DIRECTION §3.6), so each side carries its own small
// validator over the one contract; the JavaScript side is validate.js. "Small"
// is the bar: select the schema the contract names for an operation and
// direction, then validate with the OpenAPI loader's own JSON-Schema check
// (getkin/kin-openapi). This package writes no endpoint and no client.
//
// The contract is embedded, so the service can import this package and validate
// its traffic without carrying a copy of the file or a path to it.
package apicontract

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/getkin/kin-openapi/openapi3"
)

//go:embed openapi.yaml
var contractYAML []byte

// Direction says whether a payload is a request body or a response body.
type Direction string

const (
	// Request selects an operation's JSON request body schema.
	Request Direction = "request"
	// Response selects an operation's JSON response body schema at a status.
	Response Direction = "response"
)

const jsonMediaType = "application/json"

// Contract is the loaded, validated API contract.
type Contract struct {
	doc *openapi3.T
}

// Load parses and validates the embedded contract against the OpenAPI 3.1
// specification, resolving every $ref. It is the Go side of "the contract
// document validates".
func Load() (*Contract, error) {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(contractYAML)
	if err != nil {
		return nil, fmt.Errorf("loading the api contract: %w", err)
	}
	if err := doc.Validate(loader.Context); err != nil {
		return nil, fmt.Errorf("validating the api contract: %w", err)
	}
	return &Contract{doc: doc}, nil
}

// Document returns the loaded OpenAPI document.
func (c *Contract) Document() *openapi3.T {
	return c.doc
}

func (c *Contract) operation(operationID string) *openapi3.Operation {
	if c.doc.Paths == nil {
		return nil
	}
	for _, item := range c.doc.Paths.Map() {
		for _, op := range item.Operations() {
			if op != nil && op.OperationID == operationID {
				return op
			}
		}
	}
	return nil
}

func (c *Contract) schema(operationID string, dir Direction, status string) (*openapi3.Schema, error) {
	op := c.operation(operationID)
	if op == nil {
		return nil, fmt.Errorf("no operation with operationId %q in the contract", operationID)
	}
	var media *openapi3.MediaType
	switch dir {
	case Request:
		if op.RequestBody == nil || op.RequestBody.Value == nil {
			return nil, fmt.Errorf("operation %q has no request body to validate", operationID)
		}
		media = op.RequestBody.Value.Content.Get(jsonMediaType)
		if media == nil {
			return nil, fmt.Errorf("operation %q has no JSON request body", operationID)
		}
	case Response:
		if status == "" {
			return nil, fmt.Errorf("a response status is required to validate the response of %q", operationID)
		}
		if op.Responses == nil {
			return nil, fmt.Errorf("operation %q declares no responses", operationID)
		}
		resp := op.Responses.Status(statusCode(status))
		if resp == nil || resp.Value == nil {
			return nil, fmt.Errorf("operation %q has no response at status %s", operationID, status)
		}
		media = resp.Value.Content.Get(jsonMediaType)
		if media == nil {
			return nil, fmt.Errorf("operation %q has no JSON response body at status %s", operationID, status)
		}
	default:
		return nil, fmt.Errorf("unknown direction %q (expected %q or %q)", dir, Request, Response)
	}
	if media.Schema == nil || media.Schema.Value == nil {
		return nil, fmt.Errorf("operation %q has no schema for %s", operationID, dir)
	}
	return media.Schema.Value, nil
}

// statusCode turns a status string into the int kin-openapi indexes responses
// by; an unparseable status yields 0, which matches no response.
func statusCode(status string) int {
	var code int
	if _, err := fmt.Sscanf(status, "%d", &code); err != nil {
		return 0
	}
	return code
}

// Validate checks a JSON payload against the schema the contract names for the
// given operation and direction. For a response, status is the HTTP status
// (e.g. "200"); for a request it is ignored. It returns nil when the payload
// conforms, and an error describing the first mismatch otherwise.
func (c *Contract) Validate(operationID string, dir Direction, status string, payload []byte) error {
	schema, err := c.schema(operationID, dir, status)
	if err != nil {
		return err
	}
	var value any
	if err := json.Unmarshal(payload, &value); err != nil {
		return fmt.Errorf("payload is not valid JSON: %w", err)
	}
	return schema.VisitJSON(value)
}
