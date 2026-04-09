cmake_minimum_required(VERSION 3.15)
project(AuraKernel VERSION 2.0 LANGUAGES CXX)

# ============================================================================
# CONFIGURATION
# ============================================================================

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Output directories
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# ============================================================================
# COMPILER FLAGS
# ============================================================================

if(MSVC)
    # Visual Studio
    add_compile_options(/W4 /permissive-)
    add_compile_options(/MP)  # Multi-processor compilation

    if(CMAKE_BUILD_TYPE MATCHES Release)
        add_compile_options(/O2 /Ob2 /Oi /Ot /GL)
        add_link_options(/LTCG)
    endif()
else()
    # GCC/Clang
    add_compile_options(-Wall -Wextra -pedantic)

    if(CMAKE_BUILD_TYPE MATCHES Release)
        add_compile_options(-O3 -march=native)
    endif()

    if(CMAKE_BUILD_TYPE MATCHES Debug)
        add_compile_options(-g -O0)
    endif()
endif()

# ============================================================================
# DEPENDENCIES
# ============================================================================

# Find required packages
find_package(CURL REQUIRED)
find_package(OpenSSL REQUIRED)

# nlohmann/json (header-only)
find_package(nlohmann_json 3.2.0 QUIET)
if(NOT nlohmann_json_FOUND)
    message(STATUS "nlohmann/json not found, will use system includes")
    # Assume it's in system include path or manually added
endif()

# llama.cpp
set(LLAMA_CPP_DIR "${CMAKE_SOURCE_DIR}/../llama.cpp" CACHE PATH "Path to llama.cpp directory")

if(EXISTS "${LLAMA_CPP_DIR}")
    message(STATUS "Found llama.cpp at: ${LLAMA_CPP_DIR}")
    include_directories(${LLAMA_CPP_DIR})

    # Look for llama.cpp library
    find_library(LLAMA_LIB
        NAMES llama libllama
        PATHS "${LLAMA_CPP_DIR}/build"
              "${LLAMA_CPP_DIR}/build/src"
              "${LLAMA_CPP_DIR}/build/Release"
        NO_DEFAULT_PATH
    )

    if(LLAMA_LIB)
        message(STATUS "Found llama library: ${LLAMA_LIB}")
    else()
        message(WARNING "llama.cpp library not found. Local brain will not work.")
        message(WARNING "Please build llama.cpp first or adjust LLAMA_CPP_DIR")
    endif()
else()
    message(WARNING "llama.cpp directory not found at: ${LLAMA_CPP_DIR}")
    message(WARNING "Set LLAMA_CPP_DIR to the correct path or local brain will not work")
endif()

# ============================================================================
# SOURCE FILES
# ============================================================================

set(CORE_SOURCES
    Core/EngramMemory.cpp
    Core/CoreSanctuary.cpp
)

set(AUTONOMY_SOURCES
    Autonomy/Heartbeat.cpp
    Autonomy/PhoenixProtocol.cpp
)

set(COGNITION_SOURCES
    Cognition/LocalBrain.cpp
    # TODO: Add when implemented
    # Cognition/MultiBrainRouter.cpp
    # Cognition/VertexClient.cpp
    # Cognition/ClaudeClient.cpp
)

set(BRIDGE_SOURCES
    # TODO: Add when implemented
    # Bridge/PythonBridge.cpp
)

set(SECURITY_SOURCES
    # TODO: Add when implemented
    # Security/MetamateProtocol.cpp
)

set(ALL_SOURCES
    main.cpp
    ${CORE_SOURCES}
    ${AUTONOMY_SOURCES}
    ${COGNITION_SOURCES}
    ${BRIDGE_SOURCES}
    ${SECURITY_SOURCES}
)

# ============================================================================
# EXECUTABLE
# ============================================================================

add_executable(Aura ${ALL_SOURCES})

# ============================================================================
# INCLUDE DIRECTORIES
# ============================================================================

target_include_directories(Aura PRIVATE
    ${CMAKE_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/Core
    ${CMAKE_SOURCE_DIR}/Cognition
    ${CMAKE_SOURCE_DIR}/Autonomy
    ${CMAKE_SOURCE_DIR}/Bridge
    ${CMAKE_SOURCE_DIR}/Security
)

# ============================================================================
# LINK LIBRARIES
# ============================================================================

target_link_libraries(Aura
    CURL::libcurl
    OpenSSL::SSL
    OpenSSL::Crypto
)

# Link nlohmann/json if found
if(nlohmann_json_FOUND)
    target_link_libraries(Aura nlohmann_json::nlohmann_json)
endif()

# Link llama.cpp if found
if(LLAMA_LIB)
    target_link_libraries(Aura ${LLAMA_LIB})

    # On Windows, also need to link against additional libraries
    if(WIN32)
        target_link_libraries(Aura ws2_32)
    endif()

    # On Linux/Mac, need pthread
    if(UNIX)
        target_link_libraries(Aura pthread dl)
    endif()
endif()

# ============================================================================
# PLATFORM-SPECIFIC SETTINGS
# ============================================================================

if(WIN32)
    # Windows-specific libraries
    target_link_libraries(Aura ws2_32 crypt32)

    # Set console application
    set_target_properties(Aura PROPERTIES
        WIN32_EXECUTABLE FALSE
    )

    # Visual Studio: Set startup project
    set_property(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR} PROPERTY VS_STARTUP_PROJECT Aura)
endif()

if(UNIX AND NOT APPLE)
    # Linux-specific
    target_link_libraries(Aura pthread dl)
endif()

if(APPLE)
    # macOS-specific
    target_link_libraries(Aura "-framework CoreFoundation" "-framework Security")
endif()

# ============================================================================
# INSTALLATION
# ============================================================================

install(TARGETS Aura
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
)

# Install runtime dependencies (Windows)
if(WIN32)
    # Install OpenSSL DLLs (if found)
    get_filename_component(OPENSSL_BIN_DIR "${OPENSSL_INCLUDE_DIR}/../bin" ABSOLUTE)
    if(EXISTS "${OPENSSL_BIN_DIR}")
        install(DIRECTORY "${OPENSSL_BIN_DIR}/"
            DESTINATION bin
            FILES_MATCHING PATTERN "*.dll"
        )
    endif()
endif()

# ============================================================================
# CUSTOM TARGETS
# ============================================================================

# Create directories for runtime
add_custom_target(create_directories ALL
    COMMAND ${CMAKE_COMMAND} -E make_directory "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}"
    COMMENT "Creating runtime directories"
)

# Copy config template
add_custom_command(TARGET Aura POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E echo "Creating config template..."
    COMMAND ${CMAKE_COMMAND} -E echo "{" > "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/config_template.json"
    COMMENT "Creating config template"
)

# ============================================================================
# PRINT CONFIGURATION
# ============================================================================

message(STATUS "")
message(STATUS "========================================")
message(STATUS "Aura Nova Kernel Configuration")
message(STATUS "========================================")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ compiler: ${CMAKE_CXX_COMPILER}")
message(STATUS "C++ standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "")
message(STATUS "Dependencies:")
message(STATUS "  CURL: ${CURL_FOUND}")
message(STATUS "  OpenSSL: ${OPENSSL_FOUND}")
message(STATUS "  nlohmann/json: ${nlohmann_json_FOUND}")
message(STATUS "  llama.cpp: ${LLAMA_LIB}")
message(STATUS "")
message(STATUS "Output directory: ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}")
message(STATUS "========================================")
message(STATUS "")

# ============================================================================
# TESTING (Optional)
# ============================================================================

option(BUILD_TESTS "Build unit tests" OFF)

if(BUILD_TESTS)
    enable_testing()

    # Add Google Test
    find_package(GTest QUIET)

    if(GTest_FOUND)
        add_subdirectory(tests)
    else()
        message(WARNING "Google Test not found. Tests will not be built.")
    endif()
endif()

# ============================================================================
# DOCUMENTATION (Optional)
# ============================================================================

option(BUILD_DOCS "Build documentation with Doxygen" OFF)

if(BUILD_DOCS)
    find_package(Doxygen QUIET)

    if(DOXYGEN_FOUND)
        set(DOXYGEN_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/docs")
        doxygen_add_docs(docs
            ${CMAKE_SOURCE_DIR}
            COMMENT "Generating documentation"
        )
    else()
        message(WARNING "Doxygen not found. Documentation will not be built.")
    endif()
endif()
