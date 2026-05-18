#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>
#include <mach-o/dyld.h>

int main(int argc, char **argv) {
    char path[4096];
    uint32_t size = sizeof(path);
    if (_NSGetExecutablePath(path, &size) != 0) {
        fprintf(stderr, "aic: path too long\n");
        return 1;
    }

    // Find last '/' to get dirname (avoid modifying path via dirname())
    char *last = strrchr(path, '/');
    if (!last) { fprintf(stderr, "aic: invalid path\n"); return 1; }
    *last = '\0';

    // Find second-last '/' for parent of bin/
    char *prev = strrchr(path, '/');
    if (!prev) { fprintf(stderr, "aic: invalid path\n"); return 1; }

    // chdir to project root
    char root[4096];
    size_t rootlen = prev - path;
    memcpy(root, path, rootlen);
    root[rootlen] = '\0';
    if (chdir(root) != 0) {
        fprintf(stderr, "aic: could not chdir to %s\n", root);
        return 1;
    }

    // Build node args
    int total = argc + 2;
    char **args = malloc((total + 1) * sizeof(char *));
    if (!args) { fprintf(stderr, "aic: out of memory\n"); return 1; }
    args[0] = "node";
    args[1] = "bin/aic.js";
    for (int i = 1; i < argc; i++) args[i + 1] = argv[i];
    args[total] = NULL;

    execvp("node", args);

    // Fallbacks
    char *fallbacks[] = {
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
        "/Users/barun.tayenjam/.nvm/versions/node/v22.14.0/bin/node",
        NULL
    };
    for (int i = 0; fallbacks[i]; i++) execv(fallbacks[i], args);

    fprintf(stderr, "aic: node not found in PATH\n");
    free(args);
    return 1;
}
