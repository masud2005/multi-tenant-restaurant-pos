# Commit Message Convention

After completing every task, always suggest a clean Git commit message following this exact format:

```text
feat(<scope>-<module>): <description>
```

- `<scope>`: `backend` or `frontend` (depending on where the changes were made)
- `<module>`: the specific feature or module worked on (e.g., `customer-loyalty`, `order`, `auth`, `pos`)
- `<description>`: a concise, informative summary of the changes

Example:
`feat(backend-customer-loyalty): add customer and loyalty models with order relations`
