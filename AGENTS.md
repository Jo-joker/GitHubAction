# AGENTS.md

## Cursor Cloud specific instructions

This is a minimal GitHub Action repository containing only two files:
- `README.md` — project title
- `action.yaml` — a design/requirements document (in Chinese) for a deployment template preview feature; not a valid GitHub Action definition

### Key facts
- **No source code, no dependencies, no build system, no tests, no services.**
- The `action.yaml` file is plain YAML containing Chinese-language design notes. It is not a runnable GitHub Action.
- There is nothing to build, start, or run. Development work involves editing `action.yaml` and `README.md`.

### Linting
- YAML files can be validated with `yamllint`: `yamllint action.yaml`
- YAML syntax can also be checked with Python: `python3 -c "import yaml; yaml.safe_load(open('action.yaml'))"`
