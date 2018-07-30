module.exports = {
    "definitions": {
        "schemaArray": {
            "type": "array",
            "minItems": 1,
            "items": { "$ref": "#/definitions/schema" }
        },
        "nonNegativeInteger": {
            "type": "integer",
            "minimum": 0
        },
        "nonNegativeIntegerDefault0": {
            "allOf": [
                { "$ref": "#/definitions/nonNegativeInteger" },
                { "default": 0 }
            ]
        },
        "simpleTypes": {
            "enum": [
                "array",
                "boolean",
                "integer",
                "null",
                "number",
                "object",
                "string"
            ]
        },
        "stringArray": {
            "type": "array",
            "items": { "type": "string" },
            "uniqueItems": true,
            "default": []
        }
    },
    "oneOf": [{
      "type": "object",
      "required": ["$ref"],
      "additionalProperties": false,
      "properties": {
        "$ref": {
            "type": "string",
            "format": "uri-reference"
        },
      }
    }, {
      "type": ["object", "boolean"],
      "default": true,
      "additionalProperties": false,
      "properties": {
          "title": {
              "type": "string"
          },
          "description": {
              "type": "string"
          },
          "default": true,
          "examples": {
              "type": "array",
              "items": true
          },
          "multipleOf": {
              "type": "number",
              "exclusiveMinimum": 0
          },
          "maximum": {
              "type": "number"
          },
          "exclusiveMaximum": {
              "type": "number"
          },
          "minimum": {
              "type": "number"
          },
          "exclusiveMinimum": {
              "type": "number"
          },
          "maxLength": { "$ref": "#/definitions/nonNegativeInteger" },
          "minLength": { "$ref": "#/definitions/nonNegativeIntegerDefault0" },
          "pattern": {
              "type": "string",
              "format": "regex"
          },
          "items": {
              "anyOf": [
                  { "$ref": "#/definitions/schema" },
                  { "$ref": "#/definitions/schemaArray" }
              ]
          },
          "maxItems": { "$ref": "#/definitions/nonNegativeInteger" },
          "minItems": { "$ref": "#/definitions/nonNegativeIntegerDefault0" },
          "uniqueItems": {
              "type": "boolean",
              "default": false
          },
          "maxProperties": { "$ref": "#/definitions/nonNegativeInteger" },
          "minProperties": { "$ref": "#/definitions/nonNegativeIntegerDefault0" },
          "required": { "$ref": "#/definitions/stringArray" },
          "additionalProperties": { "$ref": "#/definitions/schema" },
          "definitions": {
              "type": "object",
              "additionalProperties": { "$ref": "#/definitions/schema" },
              "default": {}
          },
          "properties": {
              "type": "object",
              "additionalProperties": { "$ref": "#/definitions/schema" },
              "default": {}
          },
          "const": true,
          "enum": {
              "type": "array",
              "items": true,
              "minItems": 1,
              "uniqueItems": true
          },
          "type": {
              "anyOf": [
                  { "$ref": "#/definitions/simpleTypes" },
                  {
                      "type": "array",
                      "items": { "$ref": "#/definitions/simpleTypes" },
                      "minItems": 1,
                      "uniqueItems": true
                  }
              ]
          },
          "format": { "type": "string" },
          "contentMediaType": { "type": "string" },
          "contentEncoding": { "type": "string" },
          "not": { "$ref": "#/definitions/schema" }
      },
    }]
}
