#!/usr/bin/env bash

#
# web-vision/a11y-by-default test runner based on docker/podman.
#
if [ "${CI}" != "true" ]; then
    trap 'echo "runTests.sh SIGINT signal emitted";cleanUp;exit 2' SIGINT
fi

cleanUp() {
    ATTACHED_CONTAINERS=$(${CONTAINER_BIN} ps --filter network=${NETWORK} --format='{{.Names}}')
    for ATTACHED_CONTAINER in ${ATTACHED_CONTAINERS}; do
        ${CONTAINER_BIN} rm -f ${ATTACHED_CONTAINER} >/dev/null
    done
    ${CONTAINER_BIN} network rm ${NETWORK} >/dev/null
}

cleanCacheFiles() {
    echo -n "Clean caches ... "
    rm -rf \
        .Build/.cache \
        .php-cs-fixer.cache
    echo "done"
}

cleanTestFiles() {
    echo -n "Clean test related files ... "
    rm -rf \
        .Build/Web/typo3temp/var/tests/
    echo "done"
}

loadHelp() {
    read -r -d '' HELP <<EOF
web-vision/a11y-by-default test runner. Execute unit, functional and other
test suites in a container based test environment.

Usage: $0 [options] [file]

Options:
    -s <...>
        Specifies which test suite to run
            - cgl: check and fix all php files
            - clean: clean up build, cache and testing related files
            - cleanCache: clean up cache related files
            - composerInstall: "composer install", use after initial clone
            - npmInstall: "npm ci", use after initial clone
            - buildJs: "npm run build", build javascript assets
            - functional: functional tests
            - lintJs: javascript/typescript linting
            - phpstan: phpstan analyze
            - unit: PHP unit tests (default)

    -b <docker|podman>
        Container environment. If not specified, podman is used if available,
        otherwise docker.

    -a <mysqli|pdo_mysql>
        Only with -s functional, for mariadb/mysql DBMS.

    -d <sqlite|mariadb|mysql|postgres>
        Only with -s functional. Specifies DBMS. Default: sqlite

    -i <version>
        Only with -s functional, specifies database version.

    -t <13|14>
        TYPO3 core version to use (default: 13)

    -p <8.2|8.3|8.4>
        PHP minor version (default: 8.2)

    -x  Enable xdebug (needs IDE listening on port 9003)

    -y <port>
        xdebug port (default: 9003)

    -n  Only with -s cgl: dry-run, do not modify files

    -u  Update existing ghcr.io/typo3/core-testing-* images

    -h  Show this help

Examples:
    # Install composer dependencies (required after initial clone)
    ./Build/Scripts/runTests.sh -s composerInstall

    # Install npm dependencies (required after initial clone)
    ./Build/Scripts/runTests.sh -s npmInstall

    # Build javascript assets
    ./Build/Scripts/runTests.sh -s buildJs

    # Run unit tests
    ./Build/Scripts/runTests.sh -s unit

    # Run unit tests with TYPO3 14 / PHP 8.3
    ./Build/Scripts/runTests.sh -s unit -t 14 -p 8.3

    # Run functional tests on sqlite
    ./Build/Scripts/runTests.sh -s functional

    # Run phpstan analysis
    ./Build/Scripts/runTests.sh -s phpstan

    # Run javascript linting
    ./Build/Scripts/runTests.sh -s lintJs

    # Check code style
    ./Build/Scripts/runTests.sh -s cgl -n
EOF
}

# Test if docker or podman is available
if ! type "docker" >/dev/null 2>&1 && ! type "podman" >/dev/null 2>&1; then
    echo "This script relies on docker or podman. Please install." >&2
    exit 1
fi

# Option defaults
TEST_SUITE="unit"
CORE_VERSION="13"
DBMS="sqlite"
PHP_VERSION="8.2"
PHP_XDEBUG_ON=0
PHP_XDEBUG_PORT=9003
CGLCHECK_DRY_RUN=0
DATABASE_DRIVER=""
DBMS_VERSION=""
CONTAINER_BIN=""
CONTAINER_HOST="host.docker.internal"

OPTIND=1
INVALID_OPTIONS=()
while getopts "a:b:s:d:i:p:t:xy:nhu" OPT; do
    case ${OPT} in
        s) TEST_SUITE=${OPTARG} ;;
        b)
            if ! [[ ${OPTARG} =~ ^(docker|podman)$ ]]; then
                INVALID_OPTIONS+=("${OPTARG}")
            fi
            CONTAINER_BIN=${OPTARG}
            ;;
        a) DATABASE_DRIVER=${OPTARG} ;;
        d) DBMS=${OPTARG} ;;
        i) DBMS_VERSION=${OPTARG} ;;
        p)
            PHP_VERSION=${OPTARG}
            if ! [[ ${PHP_VERSION} =~ ^(8.2|8.3|8.4)$ ]]; then
                INVALID_OPTIONS+=("p ${OPTARG}")
            fi
            ;;
        t)
            CORE_VERSION=${OPTARG}
            if ! [[ ${CORE_VERSION} =~ ^(13|14)$ ]]; then
                INVALID_OPTIONS+=("t ${OPTARG}")
            fi
            ;;
        x) PHP_XDEBUG_ON=1 ;;
        y) PHP_XDEBUG_PORT=${OPTARG} ;;
        n) CGLCHECK_DRY_RUN=1 ;;
        h) loadHelp; echo "${HELP}"; exit 0 ;;
        u) TEST_SUITE=update ;;
        \?) INVALID_OPTIONS+=("${OPTARG}") ;;
        :)  INVALID_OPTIONS+=("${OPTARG}") ;;
    esac
done

if [ ${#INVALID_OPTIONS[@]} -ne 0 ]; then
    echo "Invalid option(s):" >&2
    for I in "${INVALID_OPTIONS[@]}"; do
        echo "-${I}" >&2
    done
    echo >&2
    echo "Call \"./Build/Scripts/runTests.sh -h\" to display help." >&2
    exit 1
fi

COMPOSER_ROOT_VERSION="0.1.0-dev"
CONTAINER_INTERACTIVE="-it --init"
HOST_UID=$(id -u)
USERSET=""
if [ "$(uname)" != "Darwin" ]; then
    USERSET="--user $HOST_UID"
fi

THIS_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "$THIS_SCRIPT_DIR" || exit 1
cd ../../ || exit 1
ROOT_DIR="${PWD}"

mkdir -p .Build/.cache
mkdir -p .Build/Web/typo3temp/var/tests

IS_CORE_CI=0
if [ "${CI}" == "true" ]; then
    IS_CORE_CI=1
    CONTAINER_INTERACTIVE=""
fi

if [[ -z "${CONTAINER_BIN}" ]]; then
    if type "podman" >/dev/null 2>&1; then
        CONTAINER_BIN="podman"
    elif type "docker" >/dev/null 2>&1; then
        CONTAINER_BIN="docker"
    fi
fi

IMAGE_PHP="ghcr.io/typo3/core-testing-$(echo "php${PHP_VERSION}" | sed -e 's/\.//'):latest"
IMAGE_NODEJS="ghcr.io/typo3/core-testing-nodejs24:1.1"
IMAGE_MARIADB="docker.io/mariadb:${DBMS_VERSION}"
IMAGE_MYSQL="docker.io/mysql:${DBMS_VERSION}"
IMAGE_POSTGRES="docker.io/postgres:${DBMS_VERSION}-alpine"

shift $((OPTIND - 1))

SUFFIX=$(echo $RANDOM)
NETWORK="a11y-by-default-${SUFFIX}"
${CONTAINER_BIN} network create ${NETWORK} >/dev/null

if [ "${CONTAINER_BIN}" == "docker" ]; then
    CONTAINER_COMMON_PARAMS="${CONTAINER_INTERACTIVE} --rm --network ${NETWORK} --add-host ${CONTAINER_HOST}:host-gateway ${USERSET} -v ${ROOT_DIR}:${ROOT_DIR} -w ${ROOT_DIR}"
else
    CONTAINER_HOST="host.containers.internal"
    CONTAINER_COMMON_PARAMS="${CONTAINER_INTERACTIVE} --rm --network ${NETWORK} ${USERSET} --userns=keep-id -v ${ROOT_DIR}:${ROOT_DIR} -w ${ROOT_DIR}"
fi

if [ ${PHP_XDEBUG_ON} -eq 0 ]; then
    XDEBUG_MODE="-e XDEBUG_MODE=off"
    XDEBUG_CONFIG=" "
else
    XDEBUG_MODE="-e XDEBUG_MODE=debug -e XDEBUG_TRIGGER=foo"
    XDEBUG_CONFIG="client_port=${PHP_XDEBUG_PORT} client_host=${CONTAINER_HOST}"
fi

case ${TEST_SUITE} in
    cgl)
        if [ "${CGLCHECK_DRY_RUN}" -eq 1 ]; then
            COMMAND="php -dxdebug.mode=off .Build/bin/php-cs-fixer fix --config Build/php-cs-fixer/php-cs-rules.php -v --dry-run --using-cache no --diff"
        else
            COMMAND="php -dxdebug.mode=off .Build/bin/php-cs-fixer fix --config Build/php-cs-fixer/php-cs-rules.php --using-cache no"
        fi
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name cgl-${SUFFIX} \
            -e COMPOSER_CACHE_DIR=.Build/.cache/composer \
            -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} \
            ${IMAGE_PHP} /bin/sh -c "${COMMAND}"
        SUITE_EXIT_CODE=$?
        ;;
    clean)
        cleanCacheFiles
        cleanTestFiles
        ;;
    cleanCache)
        cleanCacheFiles
        ;;
    composerInstall)
        COMMAND=(composer install --no-interaction)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name composer-install-${SUFFIX} \
            -e COMPOSER_CACHE_DIR=.Build/.cache/composer \
            -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} \
            ${IMAGE_PHP} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    npmInstall)
        COMMAND=(npm ci)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name npm-install-${SUFFIX} \
            -e npm_config_cache=.Build/.cache/npm \
            ${IMAGE_NODEJS} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    buildJs)
        COMMAND=(npm run build)
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name buildJs-${SUFFIX} \
            -e npm_config_cache=.Build/.cache/npm \
            ${IMAGE_NODEJS} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    lintJs)
        if [ "${CGLCHECK_DRY_RUN}" -eq 1 ]; then
            COMMAND="npm run lint:js"
        else
            COMMAND="npm run lint:js:fix"
        fi
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name lintJs-${SUFFIX} \
            -e npm_config_cache=.Build/.cache/npm \
            ${IMAGE_NODEJS} /bin/sh -c "${COMMAND}"
        SUITE_EXIT_CODE=$?
        ;;
    functional)
        PHPUNIT_CONFIG_FILE="Build/phpunit/FunctionalTests.xml"
        COMMAND=(.Build/bin/phpunit -c ${PHPUNIT_CONFIG_FILE} --exclude-group not-core-${CORE_VERSION} "$@")
        case ${DBMS} in
            mariadb)
                [ -z "${DATABASE_DRIVER}" ] && DATABASE_DRIVER="mysqli"
                [ -z "${DBMS_VERSION}" ] && DBMS_VERSION="10.11"
                ${CONTAINER_BIN} run --name mariadb-func-${SUFFIX} --network ${NETWORK} -d \
                    -e MYSQL_ROOT_PASSWORD=funcp --tmpfs /var/lib/mysql/:rw,noexec,nosuid \
                    ${IMAGE_MARIADB} >/dev/null
                CONTAINERPARAMS="-e typo3DatabaseDriver=${DATABASE_DRIVER} -e typo3DatabaseName=func_test -e typo3DatabaseUsername=root -e typo3DatabaseHost=mariadb-func-${SUFFIX} -e typo3DatabasePassword=funcp"
                ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name functional-${SUFFIX} \
                    ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" \
                    -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} \
                    ${CONTAINERPARAMS} ${IMAGE_PHP} "${COMMAND[@]}"
                SUITE_EXIT_CODE=$?
                ;;
            mysql)
                [ -z "${DATABASE_DRIVER}" ] && DATABASE_DRIVER="mysqli"
                [ -z "${DBMS_VERSION}" ] && DBMS_VERSION="8.0"
                ${CONTAINER_BIN} run --name mysql-func-${SUFFIX} --network ${NETWORK} -d \
                    -e MYSQL_ROOT_PASSWORD=funcp --tmpfs /var/lib/mysql/:rw,noexec,nosuid \
                    ${IMAGE_MYSQL} >/dev/null
                CONTAINERPARAMS="-e typo3DatabaseDriver=${DATABASE_DRIVER} -e typo3DatabaseName=func_test -e typo3DatabaseUsername=root -e typo3DatabaseHost=mysql-func-${SUFFIX} -e typo3DatabasePassword=funcp"
                ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name functional-${SUFFIX} \
                    ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" \
                    -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} \
                    ${CONTAINERPARAMS} ${IMAGE_PHP} "${COMMAND[@]}"
                SUITE_EXIT_CODE=$?
                ;;
            postgres)
                [ -z "${DBMS_VERSION}" ] && DBMS_VERSION="14"
                ${CONTAINER_BIN} run --name postgres-func-${SUFFIX} --network ${NETWORK} -d \
                    -e POSTGRES_PASSWORD=funcp -e POSTGRES_USER=funcu \
                    --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid \
                    ${IMAGE_POSTGRES} >/dev/null
                CONTAINERPARAMS="-e typo3DatabaseDriver=pdo_pgsql -e typo3DatabaseName=func_test -e typo3DatabaseUsername=funcu -e typo3DatabaseHost=postgres-func-${SUFFIX} -e typo3DatabasePassword=funcp"
                ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name functional-${SUFFIX} \
                    ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" \
                    -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} \
                    ${CONTAINERPARAMS} ${IMAGE_PHP} "${COMMAND[@]}"
                SUITE_EXIT_CODE=$?
                ;;
            sqlite)
                mkdir -p "${ROOT_DIR}/.Build/Web/typo3temp/var/tests/functional-sqlite-dbs/"
                CONTAINERPARAMS="-e typo3DatabaseDriver=pdo_sqlite --tmpfs ${ROOT_DIR}/.Build/Web/typo3temp/var/tests/functional-sqlite-dbs/:rw,noexec,nosuid"
                ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name functional-${SUFFIX} \
                    ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" \
                    -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} \
                    ${CONTAINERPARAMS} ${IMAGE_PHP} "${COMMAND[@]}"
                SUITE_EXIT_CODE=$?
                ;;
            *)
                echo "Invalid -d option: ${DBMS}" >&2; exit 1 ;;
        esac
        ;;
    phpstan)
        PHPSTAN_CONFIG_FILE="Build/phpstan/Core${CORE_VERSION}/phpstan.neon"
        COMMAND=(php -dxdebug.mode=off .Build/bin/phpstan analyse -c ${PHPSTAN_CONFIG_FILE} --no-progress --no-interaction --memory-limit 4G "$@")
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name phpstan-${SUFFIX} \
            -e COMPOSER_CACHE_DIR=.Build/.cache/composer \
            -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} \
            ${IMAGE_PHP} "${COMMAND[@]}"
        SUITE_EXIT_CODE=$?
        ;;
    unit)
        PHPUNIT_CONFIG_FILE="Build/phpunit/UnitTests.xml"
        COMMAND=(.Build/bin/phpunit -c ${PHPUNIT_CONFIG_FILE} --exclude-group not-core-${CORE_VERSION} "$@")
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name unit-${SUFFIX} \
            ${XDEBUG_MODE} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" \
            -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} \
            ${IMAGE_PHP} "${COMMAND[@]}"
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

cleanUp

echo "" >&2
echo "###########################################################################" >&2
echo "Result of ${TEST_SUITE}" >&2
echo "Container runtime: ${CONTAINER_BIN}" >&2
if [[ ${IS_CORE_CI} -eq 1 ]]; then
    echo "Environment: CI" >&2
else
    echo "Environment: local" >&2
fi
echo "PHP: ${PHP_VERSION}" >&2
echo "TYPO3: ${CORE_VERSION}" >&2
if [[ ${TEST_SUITE} == "functional" ]]; then
    echo "DBMS: ${DBMS}" >&2
fi
if [[ ${SUITE_EXIT_CODE} -eq 0 ]]; then
    echo "SUCCESS" >&2
else
    echo "FAILURE" >&2
fi
echo "###########################################################################" >&2
echo "" >&2

exit $SUITE_EXIT_CODE
