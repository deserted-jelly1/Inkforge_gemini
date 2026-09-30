#pragma once

#if defined(_WIN32) || defined(__CYGWIN__)
    #if defined(INKFORGE_BUILD_SHARED)
        #define INKFORGE_API __declspec(dllexport)
    #elif defined(INKFORGE_USE_SHARED)
        #define INKFORGE_API __declspec(dllimport)
    #else
        #define INKFORGE_API
    #endif
#else
    #if defined(__GNUC__) && __GNUC__ >= 4
        #define INKFORGE_API __attribute__((visibility("default")))
    #else
        #define INKFORGE_API
    #endif
#endif
