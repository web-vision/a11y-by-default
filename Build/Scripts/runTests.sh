#!/usr/bin/env bash

#
# pa11y extension test runner.
# Inspired by TYPO3 core runTests.sh.
#
# Usage: Build/Scripts/runTests.sh [options]
#
# Options:
#   -s <suite>    Test suite: unit|functional|cgl|phpstan (default: unit)
#   -p <version>  PHP version: 8.2|8.3|8.4 (default: 8.2)
#   -t <version>  TYPO3 version: 13|14 (default: 13)
#   -d <type>     Database: sqlite|mariadb|mysql|postgres (default: sqlite)
#   -v            Verbose output
#   -h            Print this help

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(realpath "${SCRIPT_DIR}/../../")"

# Defaults
TEST_SUITE="unit"
PHP_VERSION="8.2"
TYPO3_VERSION="13"
DBMS="sqlite"
VERBOSE=""

while getopts "s:p:t:d:vh" opt; do
    case ${opt} in
        s) TEST_SUITE="${OPTARG}" ;;
        p) PHP_VERSION="${OPTARG}" ;;
        t) TYPO3_VERSION="${OPTARG}" ;;
        d) DBMS="${OPTARG}" ;;
        v) VERBOSE="-v" ;;
        h)
            echo "Usage: Build/Scripts/runTests.sh [options]"
            echo ""
            echo "  -s <suite>    unit|functional|cgl|phpstan (default: unit)"
            echo "  -p <version>  8.2|8.3|8.4 (default: 8.2)"
            echo "  -t <version>  13|14 (default: 13)"
            echo "  -d <type>     sqlite|mariadb|mysql|postgres (default: sqlite)"
            echo "  -v            Verbose"
            echo "  -h            Help"
            exit 0
            ;;
        \?) echo "Invalid option: -${OPTARG}" >&2; exit 1 ;;
    esac
done

PHP_IMAGE="ghcr.io/typo3/core-testing/typo3-docker-php${PHP_VERSION}:latest"

if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running." >&2
    exit 1
fi

# Ensure .Build/vendor is available
if [ ! -d "${ROOT_DIR}/.Build/vendor" ]; then
    echo "Installing composer dependencies..."
    docker run --rm \
        -v "${ROOT_DIR}:/app" \
        -w /app \
        "composer:2" \
        composer install --no-interaction --quiet
fi

DOCKER_RUN="docker run --rm \
    -v ${ROOT_DIR}:/app \
    -w /app \
    -e TYPO3_VERSION=${TYPO3_VERSION} \
    ${PHP_IMAGE}"

case "${TEST_SUITE}" in
    unit)
        echo "Running unit tests..."
        ${DOCKER_RUN} \
            php .Build/bin/phpunit ${VERBOSE} \
            -c Build/phpunit/UnitTests.xml
        ;;

    functional)
        echo "Running functional tests..."
        DOCKER_DB_OPTIONS=""
        if [ "${DBMS}" = "mariadb" ]; then
            DOCKER_DB_OPTIONS="\
                -e typo3DatabaseDriver=pdo_mysql \
                -e typo3DatabaseName=func_test \
                -e typo3DatabaseUsername=root \
                -e typo3DatabasePassword=funcp \
                -e typo3DatabaseHost=mariadb"
        elif [ "${DBMS}" = "postgres" ]; then
            DOCKER_DB_OPTIONS="\
                -e typo3DatabaseDriver=pdo_pgsql \
                -e typo3DatabaseName=func_test \
                -e typo3DatabaseUsername=behat \
                -e typo3DatabasePassword=funcp \
                -e typo3DatabaseHost=postgres"
        else
            DOCKER_DB_OPTIONS="-e typo3DatabaseDriver=pdo_sqlite"
        fi
        docker run --rm \
            -v "${ROOT_DIR}:/app" \
            -w /app \
            -e TYPO3_VERSION="${TYPO3_VERSION}" \
            ${DOCKER_DB_OPTIONS} \
            "${PHP_IMAGE}" \
            php .Build/bin/phpunit ${VERBOSE} \
            -c Build/phpunit/FunctionalTests.xml
        ;;

    cgl)
        echo "Checking code style..."
        ${DOCKER_RUN} \
            php .Build/bin/php-cs-fixer fix \
            --config Build/php-cs-fixer/config.php \
            --diff \
            --dry-run \
            --allow-risky yes
        ;;

    phpstan)
        echo "Running phpstan..."
        ${DOCKER_RUN} \
            php .Build/bin/phpstan analyse \
            --configuration Build/phpstan/phpstan.neon \
            --no-progress \
            --ansi
        ;;

    *)
        echo "Error: Unknown test suite '${TEST_SUITE}'. Use -h for help." >&2
        exit 1
        ;;
esac

echo ""
echo "Done: ${TEST_SUITE}"
