#!/usr/bin/env bash

#
# web-vision/a11y-by-default test runner based on docker or podman
#
if [ "${CI}" != "true" ]; then
    trap 'echo "runTests.sh SIGINT signal emitted";cleanUp;exit 2' SIGINT
fi

printSummary() {
    cleanUp

    echo "" >&2
    echo "###########################################################################" >&2
    echo "Result of ${TEST_SUITE}" >&2
    echo "Container runtime: ${CONTAINER_BIN}" >&2
    echo "Container suffix: ${SUFFIX}"
    echo "PHP: ${PHP_VERSION}" >&2
    if [[ ${TEST_SUITE} == "functional" ]]; then
        case "${DBMS}" in
            mariadb|mysql|postgres)
                echo "DBMS: ${DBMS}  version ${DBMS_VERSION}  driver ${DATABASE_DRIVER}" >&2
                ;;
            sqlite)
                echo "DBMS: ${DBMS}" >&2
                ;;
        esac
    fi
    if [[ ${SUITE_EXIT_CODE} -eq 0 ]]; then
        echo "SUCCESS" >&2
    else
        echo "FAILURE" >&2
    fi
    echo "###########################################################################" >&2
    echo "" >&2
    exit ${SUITE_EXIT_CODE}
}

waitFor() {
    local HOST=${1}
    local PORT=${2}
    local TESTCOMMAND="
        COUNT=0;
        while ! nc -z ${HOST} ${PORT}; do
            if [ \"\${COUNT}\" -gt 10 ]; then
              echo \"Can not connect to ${HOST} port ${PORT}. Aborting.\";
              exit 1;
            fi;
            sleep 1;
            COUNT=\$((COUNT + 1));
        done;
    "
    ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name wait-for-${SUFFIX} ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" ${IMAGE_PHP} /bin/sh -c "${TESTCOMMAND}"
    if [[ $? -gt 0 ]]; then
        kill -SIGINT -$$
    fi
}

cleanUp() {
    echo "Remove container for network \"${NETWORK}\""
    ATTACHED_CONTAINERS=$(${CONTAINER_BIN} ps --filter network=${NETWORK} --format='{{.Names}}')
    for ATTACHED_CONTAINER in ${ATTACHED_CONTAINERS}; do
        ${CONTAINER_BIN} kill ${ATTACHED_CONTAINER} >/dev/null
    done
    if [ ${CONTAINER_BIN} = "docker" ]; then
        ${CONTAINER_BIN} network rm ${NETWORK} >/dev/null
    else
        ${CONTAINER_BIN} network rm -f ${NETWORK} >/dev/null
    fi
}

handleDbmsOptions() {
    # -a, -d, -i depend on each other. Validate input combinations and set defaults.
    case ${DBMS} in
        mariadb)
            [ -z "${DATABASE_DRIVER}" ] && DATABASE_DRIVER="mysqli"
            if [ "${DATABASE_DRIVER}" != "mysqli" ] && [ "${DATABASE_DRIVER}" != "pdo_mysql" ]; then
                echo "Invalid combination -d ${DBMS} -a ${DATABASE_DRIVER}" >&2
                echo >&2
                echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
                exit 1
            fi
            [ -z "${DBMS_VERSION}" ] && DBMS_VERSION="10.4"
            if ! [[ ${DBMS_VERSION} =~ ^(10.4|10.5|10.6|10.7|10.8|10.9|10.10|10.11|11.0|11.1|11.2|11.3|11.4)$ ]]; then
                echo "Invalid combination -d ${DBMS} -i ${DBMS_VERSION}" >&2
                echo >&2
                echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
                exit 1
            fi
            ;;
        mysql)
            [ -z "${DATABASE_DRIVER}" ] && DATABASE_DRIVER="mysqli"
            if [ "${DATABASE_DRIVER}" != "mysqli" ] && [ "${DATABASE_DRIVER}" != "pdo_mysql" ]; then
                echo "Invalid combination -d ${DBMS} -a ${DATABASE_DRIVER}" >&2
                echo >&2
                echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
                exit 1
            fi
            [ -z "${DBMS_VERSION}" ] && DBMS_VERSION="8.0"
            if ! [[ ${DBMS_VERSION} =~ ^(8.0|8.1|8.2|8.3|8.4)$ ]]; then
                echo "Invalid combination -d ${DBMS} -i ${DBMS_VERSION}" >&2
                echo >&2
                echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
                exit 1
            fi
            ;;
        postgres)
            if [ -n "${DATABASE_DRIVER}" ]; then
                echo "Invalid combination -d ${DBMS} -a ${DATABASE_DRIVER}" >&2
                echo >&2
                echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
                exit 1
            fi
            [ -z "${DBMS_VERSION}" ] && DBMS_VERSION="10"
            if ! [[ ${DBMS_VERSION} =~ ^(10|11|12|13|14|15|16)$ ]]; then
                echo "Invalid combination -d ${DBMS} -i ${DBMS_VERSION}" >&2
                echo >&2
                echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
                exit 1
            fi
            ;;
        sqlite)
            if [ -n "${DATABASE_DRIVER}" ]; then
                echo "Invalid combination -d ${DBMS} -a ${DATABASE_DRIVER}" >&2
                echo >&2
                echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
                exit 1
            fi
            if [ -n "${DBMS_VERSION}" ]; then
                echo "Invalid combination -d ${DBMS} -i ${DATABASE_DRIVER}" >&2
                echo >&2
                echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
                exit 1
            fi
            ;;
        *)
            echo "Invalid option -d ${DBMS}" >&2
            echo >&2
            echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
            exit 1
            ;;
    esac
}

cleanBuildFiles() {
    echo -n "Clean build files ... "
    rm -rf \
        Resources/Public/JavaScript/a11y-module.js \
        Resources/Public/JavaScript/a11y-module.js.map \
        Resources/Public/JavaScript/page-layout-summary.js \
        Resources/Public/JavaScript/page-layout-summary.js.map
    echo "done"
}

cleanCacheFiles() {
    echo -n "Clean caches ... "
    rm -rf \
        .cache \
        Build/.cache \
        Build/composer/.cache/ \
        .php-cs-fixer.cache
    echo "done"
}

cleanTestFiles() {
    # composer distribution test
    echo -n "Clean composer distribution test ... "
    rm -rf \
        Build/composer/composer.json \
        Build/composer/composer.lock \
        Build/composer/public/index.php \
        Build/composer/public/typo3 \
        Build/composer/public/typo3conf/ext \
        Build/composer/var/ \
        Build/composer/vendor/
    echo "done"

    # test related
    echo -n "Clean test related files ... "
    rm -rf \
        Build/phpunit/FunctionalTests-Job-*.xml \
        typo3temp/var/tests/
    echo "done"
}

cleanRenderedDocumentationFiles() {
    echo -n "Clean rendered documentation files ... "
    rm -rf \
        typo3/sysext/*/Documentation-GENERATED-temp
    echo "done"
}

getPhpImageVersion() {
    case ${1} in
        8.2)
            echo -n "1.15"
            ;;
        8.3)
            echo -n "1.16"
            ;;
        8.4)
            echo -n "1.8"
            ;;
        8.5)
            echo -n "1.8"
            ;;
    esac
}

loadHelp() {
    # Load help text into $HELP
    read -r -d '' HELP <<EOF
web-vision/a11y-by-default test runner. Execute unit, functional and other
test suites in a container based test environment.

Usage: \$0 [options] [file]

Options:
    -s <...>
        Specifies the test suite to run
            - buildJs: build javascript assets
            - cgl: check and fix all php files
            - checkBom: check UTF-8 files do not contain BOM
            - checkExceptionCodes: check for duplicate exception codes
            - checkIntegrityXliff: check integrity of .xlf files
            - checkRst: check integrity of Documentation/*.rst files
            - clean: clean up build, cache and testing related files
            - cleanBuild: clean up build related files
            - cleanCache: clean up cache related files
            - cleanTests: clean up testing related files
            - composerInstall: "composer install", use after initial clone
            - composerUpdate: temporarily require typo3/minimal:^<t> to pin
              the resolved TYPO3 core version, then restore composer.json
            - functional: functional tests
            - lintJs: javascript/typescript linting
            - lintPhp: PHP linting
            - npmInstall: "npm ci", use after initial clone
            - phpstan: phpstan analyze
            - renderDocs: render documentation using the PHP-based renderer
            - unit: PHP unit tests (default)
            - update: same as -u, pull/prune ghcr.io/typo3/core-testing-* images
            - composer: "composer" command dispatcher, to execute various composer commands
            - npm: "npm" command dispatcher, to execute various npm commands directly

    -b <docker|podman>
        Container environment:
            - podman (default)
            - docker

    -t <13|14>
        TYPO3 core version to use (default: 13)

    -p <8.2|8.3|8.4|8.5>
        PHP minor version (default: 8.2)

    -a <mysqli|pdo_mysql>
        Only with -s functional
        Specifies to use another driver, following combinations are available:
            - mysql
                - mysqli (default)
                - pdo_mysql
            - mariadb
                - mysqli (default)
                - pdo_mysql

    -d <sqlite|mariadb|mysql|postgres>
        Only with -s functional
        Specifies on which DBMS tests are performed
            - sqlite: (default): use sqlite
            - mariadb: use mariadb
            - mysql: use MySQL
            - postgres: use postgres

    -i version
        Specify a specific database version

    -x
        Enable xdebug (needs IDE listening on port 9003)

    -y <port>
        Send xdebug information to a different port than default 9003 if an IDE like PhpStorm
        is not listening on default port.

    -n
        Only with -s cgl or -s lintJs
        Activate dry-run: do not modify files, only report issues.

    -u
        Update existing typo3/core-testing-* container images and remove obsolete dangling image versions.
        Use this if weird test errors occur.

    -h
        Show this help.

Examples:
    # Run all unit tests using PHP 8.2
    ./Build/Scripts/runTests.sh
    ./Build/Scripts/runTests.sh -s unit

    # Run all units tests and enable xdebug (have a PhpStorm listening on port 9003!)
    ./Build/Scripts/runTests.sh -x

    # Run unit tests on PHP 8.3
    ./Build/Scripts/runTests.sh -p 8.3

    # Run functional tests on postgres
    ./Build/Scripts/runTests.sh -s functional -d postgres

    # Run composer install
    ./Build/Scripts/runTests.sh -s composerInstall

    # Pin dependencies to TYPO3 v13 before running tests against it
    ./Build/Scripts/runTests.sh -t 13 -s composerUpdate

    # Run npm ci
    ./Build/Scripts/runTests.sh -s npmInstall

    # Build assets
    ./Build/Scripts/runTests.sh -s buildJs
EOF
}

# Test if docker exists, else exit out with error
if ! type "docker" >/dev/null 2>&1 && ! type "podman" >/dev/null 2>&1; then
    echo "This script relies on docker or podman. Please install" >&2
    exit 1
fi

# Go to the directory this script is located, so everything else is relative
# to this dir, no matter from where this script is called, then go up two dirs.
THIS_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "$THIS_SCRIPT_DIR" || exit 1
cd ../../ || exit 1
CORE_ROOT="${PWD}"

# Default variables
# Default variables
TEST_SUITE="unit"
CORE_VERSION="13"
DBMS="sqlite"
DBMS_VERSION=""
PHP_VERSION="8.2"
PHP_XDEBUG_ON=0
PHP_XDEBUG_PORT=9003
CGLCHECK_DRY_RUN=""
DATABASE_DRIVER=""
CONTAINER_BIN=""
COMPOSER_ROOT_VERSION="1.0.1-dev"
PHPSTAN_CONFIG_FILE="phpstan.neon"
CONTAINER_INTERACTIVE="-it --init"
HOST_UID=$(id -u)
HOST_PID=$(id -g)
USERSET=""
CI_PARAMS="${CI_PARAMS:-}"
CI_JOB_ID=${CI_JOB_ID:-}
SUFFIX=$(echo $RANDOM)
if [ ${CI_JOB_ID} ]; then
    SUFFIX="${CI_JOB_ID}-${SUFFIX}"
fi
NETWORK="typo3-core-${SUFFIX}"
CONTAINER_HOST="host.docker.internal"
# Option parsing updates above default vars
OPTIND=1
INVALID_OPTIONS=()
while getopts ":a:b:s:d:i:p:t:xy:nhu" OPT; do
    case ${OPT} in
        s)
            TEST_SUITE=${OPTARG}
            ;;
        b)
            if ! [[ ${OPTARG} =~ ^(docker|podman)$ ]]; then
                INVALID_OPTIONS+=("${OPTARG}")
            fi
            CONTAINER_BIN=${OPTARG}
            ;;
        t)
            CORE_VERSION=${OPTARG}
            if ! [[ ${CORE_VERSION} =~ ^(13|14)$ ]]; then
                INVALID_OPTIONS+=("t ${OPTARG}")
            fi
            ;;
        a)
            DATABASE_DRIVER=${OPTARG}
            ;;
        d)
            if ! [[ ${OPTARG} =~ ^(sqlite|mariadb|mysql|postgres)$ ]]; then
                INVALID_OPTIONS+=("d ${OPTARG}")
            fi
            DBMS=${OPTARG}
            ;;
        i)
            DBMS_VERSION=${OPTARG}
            ;;
        p)
            PHP_VERSION=${OPTARG}
            if ! [[ ${PHP_VERSION} =~ ^(8.2|8.3|8.4|8.5)$ ]]; then
                INVALID_OPTIONS+=("p ${OPTARG}")
            fi
            ;;
        x)
            PHP_XDEBUG_ON=1
            ;;
        y)
            PHP_XDEBUG_PORT=${OPTARG}
            ;;
        n)
            CGLCHECK_DRY_RUN="-n"
            ;;
        h)
            loadHelp
            echo "${HELP}"
            exit 0
            ;;
        u)
            TEST_SUITE=update
            ;;
        \?)
            INVALID_OPTIONS+=("${OPTARG}")
            ;;
        :)
            INVALID_OPTIONS+=("${OPTARG}")
            ;;
    esac
done
# Exit on invalid options
if [ ${#INVALID_OPTIONS[@]} -ne 0 ]; then
    echo "Invalid option(s):" >&2
    for I in "${INVALID_OPTIONS[@]}"; do
        echo "-"${I} >&2
    done
    echo >&2
    echo "Use \".Build/Scripts/runTests.sh -h\" to display help and valid options" >&2
    exit 1
fi

handleDbmsOptions

if [ "${CI}" == "true" ]; then
    # ENV var "CI" is set by gitlab-ci. Use it to force some CI details.
    PHPSTAN_CONFIG_FILE="phpstan.ci.neon"
    CONTAINER_INTERACTIVE=""
elif [ ! -t 0 ] || [ ! -t 1 ]; then
    # If stdin or stdout is not a TTY (e.g. a script runner, pipe, or non-interactive shell),
    # drop the interactive "-it" flags automatically to avoid podman warning "The input device
    # is not a TTY." and docker failure, and to keep redirected output free of TTY control characters.
    # Keep "--init" so the PID 1 init process still forwards signals (e.g. ctrl-c) to the test process.
    CONTAINER_INTERACTIVE="--init"
fi

# determine default container binary to use: 1. podman 2. docker
if [[ -z "${CONTAINER_BIN}" ]]; then
    if type "podman" >/dev/null 2>&1; then
        CONTAINER_BIN="podman"
    elif type "docker" >/dev/null 2>&1; then
        CONTAINER_BIN="docker"
    fi
fi

if [ $(uname) != "Darwin" ] && [ ${CONTAINER_BIN} = "docker" ]; then
    # Run docker jobs as current user to prevent permission issues. Not needed with podman.
    USERSET="--user $HOST_UID"
fi

if ! type ${CONTAINER_BIN} >/dev/null 2>&1; then
    echo "Selected container environment \"${CONTAINER_BIN}\" not found. Please install or use -b option to select one." >&2
    exit 1
fi

IMAGE_PHP="ghcr.io/typo3/core-testing-$(echo "php${PHP_VERSION}" | sed -e 's/\.//'):$(getPhpImageVersion $PHP_VERSION)"

IMAGE_NODEJS="ghcr.io/typo3/core-testing-nodejs24:1.1"
IMAGE_MARIADB="docker.io/mariadb:${DBMS_VERSION}"
IMAGE_MYSQL="docker.io/mysql:${DBMS_VERSION}"
IMAGE_POSTGRES="docker.io/postgres:${DBMS_VERSION}-alpine"
# Not a bug; render-guides has no "1.x" release yet.
IMAGE_RSTRENDERING="ghcr.io/typo3-documentation/render-guides:0.37"

# Remove handled options and leaving the rest in the line, so it can be passed raw to commands
shift $((OPTIND - 1))

# Create .cache dir: composer and various npm jobs need this.
mkdir -p .cache
mkdir -p typo3temp/var/tests

${CONTAINER_BIN} network create ${NETWORK} >/dev/null

if [ ${CONTAINER_BIN} = "docker" ]; then
    # docker needs the add-host for xdebug remote debugging. podman has host.container.internal built in
    CONTAINER_COMMON_PARAMS="${CONTAINER_INTERACTIVE} --rm --network ${NETWORK} --add-host "${CONTAINER_HOST}:host-gateway" ${USERSET} -v ${CORE_ROOT}:${CORE_ROOT} -w ${CORE_ROOT}"
    TMPFS_MOUNT_OPTIONS="rw,noexec,nosuid,uid=${HOST_UID},gid=${HOST_PID}"
else
    # podman
    CONTAINER_HOST="host.containers.internal"
    CONTAINER_COMMON_PARAMS="${CONTAINER_INTERACTIVE} ${CI_PARAMS} --rm --network ${NETWORK} -v ${CORE_ROOT}:${CORE_ROOT} -w ${CORE_ROOT}"
    TMPFS_MOUNT_OPTIONS="rw,noexec,nosuid"
fi

if [[ "${CI}" == "true" ]]; then
    CONTAINER_COMMON_PARAMS="${CONTAINER_COMMON_PARAMS} ${CONTAINER_COMMON_PARAMS_CI:-}"
fi

if [ ${PHP_XDEBUG_ON} -eq 0 ]; then
    XDEBUG_MODE="-e XDEBUG_MODE=off"
    XDEBUG_CONFIG=" "
    PHP_FPM_OPTIONS="-d xdebug.mode=off"
else
    XDEBUG_MODE="-e XDEBUG_MODE=debug -e XDEBUG_TRIGGER=foo"
    XDEBUG_CONFIG="client_port=${PHP_XDEBUG_PORT} client_host=${CONTAINER_HOST}"
    PHP_FPM_OPTIONS="-d xdebug.mode=debug -d xdebug.start_with_request=yes -d xdebug.client_host=${CONTAINER_HOST} -d xdebug.client_port=${PHP_XDEBUG_PORT} -d memory_limit=256M"
fi

# Suite execution
case ${TEST_SUITE} in
    buildJs)
        COMMAND=(npm run build)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name buildJs-${SUFFIX} -e npm_config_cache=.Build/.cache/npm ${IMAGE_NODEJS} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    cgl)
        # Active dry-run for cgl needs not "-n" but specific options
        if [ -n "${CGLCHECK_DRY_RUN}" ]; then
            COMMAND="php -dxdebug.mode=off .Build/bin/php-cs-fixer fix --config Build/php-cs-fixer/php-cs-rules.php -v --dry-run --using-cache no --diff"
        else
            COMMAND="php -dxdebug.mode=off .Build/bin/php-cs-fixer fix --config Build/php-cs-fixer/php-cs-rules.php --using-cache no"
        fi
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name cgl-${SUFFIX} ${IMAGE_PHP} /bin/sh -c "${COMMAND}"
        SUITE_EXIT_CODE=$?
        ;;
    clean)
        cleanBuildFiles
        cleanCacheFiles
        cleanTestFiles
        ;;
    cleanBuild)
        cleanBuildFiles
        ;;
    cleanCache)
        cleanCacheFiles
        ;;
    cleanTests)
        cleanTestFiles
        ;;
    composer)
        COMMAND=(composer "$@")
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name composer-${SUFFIX} -e COMPOSER_CACHE_DIR=.Build/.cache/composer -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} ${IMAGE_PHP} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    composerInstall)
        COMMAND=(composer install --no-progress --no-interaction "$@")
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name composer-install-${SUFFIX} -e COMPOSER_CACHE_DIR=.Build/.cache/composer -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} ${IMAGE_PHP} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    composerUpdate)
        # composer.json declares "^13.4 || ^14.3" for typo3/cms-core, so a plain
        # "composer install/update" always resolves the newest matching major
        # regardless of -t. Temporarily requiring typo3/minimal:^<CORE_VERSION>
        # forces the solver to pin that major; composer.json is restored
        # afterwards so the temporary requirement is never committed, while
        # the resulting composer.lock/vendor stay resolved to that version.
        # An existing lock file constrains "require" to a partial update, which
        # can't flip other dual-major dev deps (e.g. saschaegerer/phpstan-typo3)
        # across the same major boundary, so the lock is dropped first to force
        # a full, fresh resolve every time, regardless of the previous -t run.
        # The vendor dir is dropped too: transitioning typo3/class-alias-loader
        # in place (rather than a clean install) leaves its own autoloader in
        # an inconsistent state mid-dump ("Class ...IncludeFile\...Token not
        # found"), since the plugin needs its own classes loaded to generate
        # the very alias map it's part of.
        rm -f composer.lock
        rm -rf .Build/vendor
        cp composer.json composer.json.orig
        COMMAND=(composer require --dev "typo3/minimal:^${CORE_VERSION}" --with-all-dependencies --no-blocking --no-progress --no-interaction)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name composer-update-${SUFFIX} -e COMPOSER_CACHE_DIR=.Build/.cache/composer -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} ${IMAGE_PHP} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        mv composer.json.orig composer.json
        ;;
    checkBom)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name check-utf8bom-${SUFFIX} ${IMAGE_PHP} Build/Scripts/checkUtf8Bom.sh
        SUITE_EXIT_CODE=$?
        ;;
    checkExceptionCodes)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name check-exception-codes-${SUFFIX} ${IMAGE_PHP} Build/Scripts/duplicateExceptionCodeCheck.sh
        SUITE_EXIT_CODE=$?
        ;;
    checkIntegrityXliff)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name check-integrity-xliff-${SUFFIX} ${IMAGE_PHP} php Build/Scripts/checkIntegrityXliff.php "$@"
        SUITE_EXIT_CODE=$?
        ;;
    checkRst)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name check-rst-${SUFFIX} ${IMAGE_PHP} php -dxdebug.mode=off Build/Scripts/validateRstFiles.php "$@"
        SUITE_EXIT_CODE=$?
        ;;
    functional)
        PHPUNIT_CONFIG_FILE="Build/phpunit/FunctionalTests.xml"
        COMMAND=(.Build/bin/phpunit -c ${PHPUNIT_CONFIG_FILE} --exclude-group not-core-${CORE_VERSION} "$@")
        case ${DBMS} in
            mariadb)
                ${CONTAINER_BIN} run --rm ${CI_PARAMS} --name mariadb-func-${SUFFIX} --network ${NETWORK} -d -e MYSQL_ROOT_PASSWORD=funcp --tmpfs /var/lib/mysql/:rw,noexec,nosuid ${IMAGE_MARIADB} >/dev/null
                waitFor mariadb-func-${SUFFIX} 3306
                CONTAINERPARAMS="-e typo3DatabaseDriver=${DATABASE_DRIVER} -e typo3DatabaseName=func_test -e typo3DatabaseUsername=root -e typo3DatabaseHost=mariadb-func-${SUFFIX} -e typo3DatabasePassword=funcp"
                ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name functional-${SUFFIX} ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} ${CONTAINERPARAMS} ${IMAGE_PHP} "${COMMAND[@]}"
                SUITE_EXIT_CODE=$?
                ;;
            mysql)
                ${CONTAINER_BIN} run --rm ${CI_PARAMS} --name mysql-func-${SUFFIX} --network ${NETWORK} -d -e MYSQL_ROOT_PASSWORD=funcp --tmpfs /var/lib/mysql/:rw,noexec,nosuid ${IMAGE_MYSQL} >/dev/null
                waitFor mysql-func-${SUFFIX} 3306
                CONTAINERPARAMS="-e typo3DatabaseDriver=${DATABASE_DRIVER} -e typo3DatabaseName=func_test -e typo3DatabaseUsername=root -e typo3DatabaseHost=mysql-func-${SUFFIX} -e typo3DatabasePassword=funcp"
                ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name functional-${SUFFIX} ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} ${CONTAINERPARAMS} ${IMAGE_PHP} "${COMMAND[@]}"
                SUITE_EXIT_CODE=$?
                ;;
            postgres)
                ${CONTAINER_BIN} run --rm ${CI_PARAMS} --name postgres-func-${SUFFIX} --network ${NETWORK} -d -e POSTGRES_PASSWORD=funcp -e POSTGRES_USER=funcu --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid ${IMAGE_POSTGRES} >/dev/null
                waitFor postgres-func-${SUFFIX} 5432
                CONTAINERPARAMS="-e typo3DatabaseDriver=pdo_pgsql -e typo3DatabaseName=func_test -e typo3DatabaseUsername=funcu -e typo3DatabaseHost=postgres-func-${SUFFIX} -e typo3DatabasePassword=funcp"
                ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name functional-${SUFFIX} ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} ${CONTAINERPARAMS} ${IMAGE_PHP} "${COMMAND[@]}"
                SUITE_EXIT_CODE=$?
                ;;
            sqlite)
                mkdir -p "${CORE_ROOT}/.Build/Web/typo3temp/var/tests/functional-sqlite-dbs/"
                CONTAINERPARAMS="-e typo3DatabaseDriver=pdo_sqlite --tmpfs ${CORE_ROOT}/.Build/Web/typo3temp/var/tests/functional-sqlite-dbs/:${TMPFS_MOUNT_OPTIONS}"
                ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name functional-${SUFFIX} ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} ${CONTAINERPARAMS} ${IMAGE_PHP} "${COMMAND[@]}"
                SUITE_EXIT_CODE=$?
                ;;
        esac
        ;;
    lintJs)
        if [ -n "${CGLCHECK_DRY_RUN}" ]; then
            COMMAND="npm run lint:js"
        else
            COMMAND="npm run lint:js:fix"
        fi
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name lintJs-${SUFFIX} -e npm_config_cache=.Build/.cache/npm ${IMAGE_NODEJS} /bin/sh -c "${COMMAND}"
        SUITE_EXIT_CODE=$?
        ;;
    lintPhp)
        COMMAND="php -v | grep '^PHP'; find . -name \\*.php -not -path \"./.Build/*\" -not -path \"./node_modules/*\" -not -path \"./var/*\" -print0 | xargs -0 -n1 -P\"$(nproc 2>/dev/null || echo 4)\" php -dxdebug.mode=off -l >/dev/null"
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name lint-php-${SUFFIX} ${IMAGE_PHP} /bin/sh -c "${COMMAND}"
        SUITE_EXIT_CODE=$?
        ;;
    npm)
        COMMAND=(npm "$@")
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} -e HOME=${CORE_ROOT}/.cache --name npm-${SUFFIX} ${IMAGE_NODEJS} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    npmInstall)
        COMMAND=(npm ci)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name npm-install-${SUFFIX} -e npm_config_cache=.Build/.cache/npm ${IMAGE_NODEJS} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    phpstan)
        PHPSTAN_CONFIG_FILE="Build/phpstan/Core${CORE_VERSION}/phpstan.neon"
        COMMAND=(.Build/bin/phpstan analyse -c ${PHPSTAN_CONFIG_FILE} --no-progress --no-interaction --memory-limit 4G "$@")
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name phpstan-${SUFFIX} -e COMPOSER_CACHE_DIR=.Build/.cache/composer -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} ${IMAGE_PHP} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    renderDocs)
        COMMAND=(--config=Documentation --no-progress)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name renderDocs-${SUFFIX} ${IMAGE_RSTRENDERING} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    unit)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name unit-${SUFFIX} ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} ${IMAGE_PHP} .Build/bin/phpunit -c Build/phpunit/UnitTests.xml --exclude-group not-core-${CORE_VERSION} "$@"
        SUITE_EXIT_CODE=$?
        ;;
    update)
        echo "> Pulling ghcr.io/typo3/core-testing-* images that exist locally"
        ${CONTAINER_BIN} images "ghcr.io/typo3/core-testing-*" --format "{{.Repository}}:{{.Tag}}" | xargs -I {} ${CONTAINER_BIN} pull {}
        echo ""
        echo "> Removing dangling ghcr.io/typo3/core-testing-* images"
        ${CONTAINER_BIN} images --filter "reference=ghcr.io/typo3/core-testing-*" --filter "dangling=true" --format "{{.ID}}" | xargs -I {} ${CONTAINER_BIN} rmi -f {}
        echo ""
        SUITE_EXIT_CODE=0
        ;;
    *)
        loadHelp
        echo "Invalid -s option: ${TEST_SUITE}" >&2
        echo >&2
        echo "${HELP}" >&2
        exit 1
        ;;
esac
# Cleanup, print summary && exit with exitcode
printSummary
