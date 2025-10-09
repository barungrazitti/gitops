# AI Commit Generator - Agent Guidelines

## Build/Lint/Test Commands

### Testing

- `npm test` - Run full Jest test suite (30-60s)
- `npx jest tests/core.test.js` - Run single test file
- `npm run test:quick` - Fast validation (2-5s)
- `npm run test:simple` - Comprehensive standalone test (10-30s)
- `npm run test:coverage` - Jest with coverage report
- `npm run test:watch` - Jest in watch mode for development

### Code Quality

- `npm run lint` - Run ESLint on src/ directory
- `npm run format` - Format code with Prettier

## Code Style Guidelines

### Imports & Structure

- Use CommonJS require() statements (not ES modules)
- Group imports: external libs first, then internal modules
- Use relative paths for internal modules: `./core/git-manager`

### Naming Conventions

- Classes: PascalCase (e.g., `GitManager`, `AICommitGenerator`)
- Methods/Variables: camelCase (e.g., `getStagedDiff`, `configManager`)
- Files: kebab-case for executables, PascalCase for classes
- Constants: UPPER_SNAKE_CASE

### Error Handling

- Always wrap async operations in try-catch blocks
- Throw descriptive Error objects with context
- Use consistent error message format: `Failed to [action]: ${error.message}`

### Code Patterns

- Use JSDoc comments for all classes and public methods
- Maintain consistent async/await pattern (no Promise chains)
- Use object destructuring for options: `const { provider, count } = options`
- Validate inputs early and fail fast

### Testing

- Write unit tests in `tests/` directory with `.test.js` extension
- Use Jest describe/test blocks with descriptive names
- Mock external dependencies in `tests/mocks/`
- Test both success and error cases
- Use beforeEach for test isolation

### File Organization

- Core logic in `src/core/`
- AI providers in `src/providers/`
- Binaries in `bin/`
- Tests in `tests/`
- Keep related functionality in separate modules
