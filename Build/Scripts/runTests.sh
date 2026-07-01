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
    if [[ ${TEST_SUITE} =~ ^(functional|e2e-install|e2e-install-prepare|e2e-install-browser)$ ]]; then
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
    echo -n "Clean builds ... "
    rm -rf \
        Build/JavaScript \
        Build/node_modules
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

# @todo: Add support for all available database engines (see -d option)
runPlaywright() {
    PREPAREPARAMS="-e TYPO3_DB_DRIVER=sqlite"
    TESTPARAMS="-e typo3DatabaseDriver=pdo_sqlite"

    if [ "${PLAYWRIGHT_USE_EXISTING_INSTANCE}x" = "x" ]; then
        rm -rf "${CORE_ROOT}/typo3temp/var/tests/playwright-composer" "${CORE_ROOT}/typo3temp/var/tests/playwright-reports" "${CORE_ROOT}/typo3temp/var/tests/playwright-results"
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name playwright-prepare ${XDEBUG_MODE} -e COMPOSER_CACHE_DIR=${CORE_ROOT}/.cache/composer -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" ${PREPAREPARAMS} ${IMAGE_PHP} "${CORE_ROOT}/Build/Scripts/setupAcceptanceComposer.sh" "typo3temp/var/tests/playwright-composer"
        if [[ $? -gt 0 ]]; then
            kill -SIGINT -$$
        fi
    fi

    [[ -e "${CORE_ROOT}/Build/node_modules/.bin/playwright" ]] || ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name playwright-${SUFFIX}-npm-ci \
        -e HOME=${CORE_ROOT}/.cache \
        ${IMAGE_NODEJS_CHROME} \
        npm --prefix=Build ci
        if [[ $? -gt 0 ]]; then
            kill -SIGINT -$$
        fi

    APACHE_OPTIONS="-e APACHE_RUN_USER=#${HOST_UID} -e APACHE_RUN_SERVERNAME=web -e APACHE_RUN_GROUP=#${HOST_PID} -e APACHE_RUN_DOCROOT=${CORE_ROOT}/typo3temp/var/tests/playwright-composer/public -e PHPFPM_HOST=phpfpm -e PHPFPM_PORT=9000"
    if [[ ${PLAYWRIGHT_PREPARE_ONLY} -eq 1 || ${PLAYWRIGHT_BROWSER} -eq 1 ]]; then
        APACHE_OPTIONS="${APACHE_OPTIONS} -p 127.0.0.1::80"
    fi

    if [ ${CONTAINER_BIN} = "docker" ]; then
        ${CONTAINER_BIN} run --rm -d --name ac-phpfpm-${SUFFIX} --network ${NETWORK} --network-alias phpfpm --add-host "${CONTAINER_HOST}:host-gateway" ${USERSET} -e PHPFPM_USER=${HOST_UID} -e PHPFPM_GROUP=${HOST_PID} -e PHPFPM_PM_MAX_CHILDREN=50 -e PHPFPM_PM_START_SERVERS=10 -e PHPFPM_PM_MIN_SPARE_SERVERS=5 -e PHPFPM_PM_MAX_SPARE_SERVERS=15 -v ${CORE_ROOT}:${CORE_ROOT} ${IMAGE_PHP} php-fpm ${PHP_FPM_OPTIONS} >/dev/null
        SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
        ${CONTAINER_BIN} run --rm -d --name ac-web-${SUFFIX} --network ${NETWORK} --network-alias web --add-host "${CONTAINER_HOST}:host-gateway" -v ${CORE_ROOT}:${CORE_ROOT} ${APACHE_OPTIONS} ${IMAGE_APACHE} >/dev/null
        SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
    else
        ${CONTAINER_BIN} run ${CI_PARAMS} -d --name ac-phpfpm-${SUFFIX} --network ${NETWORK} --network-alias phpfpm ${USERSET} -e PHPFPM_USER=0 -e PHPFPM_GROUP=0 -e PHPFPM_PM_MAX_CHILDREN=50 -e PHPFPM_PM_START_SERVERS=10 -e PHPFPM_PM_MIN_SPARE_SERVERS=5 -e PHPFPM_PM_MAX_SPARE_SERVERS=15 -v ${CORE_ROOT}:${CORE_ROOT} ${IMAGE_PHP} php-fpm -R ${PHP_FPM_OPTIONS} >/dev/null
        SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
        ${CONTAINER_BIN} run --rm ${CI_PARAMS} -d --name ac-web-${SUFFIX} --network ${NETWORK} --network-alias web -v ${CORE_ROOT}:${CORE_ROOT} ${APACHE_OPTIONS} ${IMAGE_APACHE} >/dev/null
        SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
    fi

    waitFor web 80

    PLAYWRIGHT_SHARD=""
    if [ "${CHUNKS}" -gt 0 ]; then
        PLAYWRIGHT_SHARD=" --shard=${THISCHUNK}/${CHUNKS}"
    fi
    COMMAND="npm --prefix=${CORE_ROOT}/Build run playwright:run -- ${PLAYWRIGHT_PROJECT}${PLAYWRIGHT_SHARD}"
    COMMAND_UI="npm --prefix=${CORE_ROOT}/Build run playwright:open -- ${PLAYWRIGHT_PROJECT}"
    PLAYWRIGHT_GUI_PORT=43837

    if [[ ${PLAYWRIGHT_PREPARE_ONLY} -eq 0 && ${PLAYWRIGHT_BROWSER} -eq 1 ]]; then
        PLAYWRIGHT_BASE_URL="http://$(${CONTAINER_BIN} port ac-web-${SUFFIX} 80/tcp)/typo3/"
        ${CONTAINER_BIN} run -d ${CONTAINER_COMMON_PARAMS} --name ac-browser-${SUFFIX} -p $PLAYWRIGHT_GUI_PORT -e CHROME_SANDBOX=false -e PLAYWRIGHT_BASE_URL=http://web:80/typo3/ ${IMAGE_PLAYWRIGHT} ${COMMAND} --ui --ui-port=$PLAYWRIGHT_GUI_PORT --ui-host=0.0.0.0 > /dev/null 2>&1
        SUITE_EXIT_CODE=$?
        PLAYWRIGHT_BROWSER_URL="http://127.0.0.1:$(${CONTAINER_BIN} port ac-browser-${SUFFIX} ${PLAYWRIGHT_GUI_PORT}/tcp | head -n 1 | cut -d: -f2)"

        echo -en "\033[32m✓\033[0m Playwright is ready..."
        echo -en "\n  * Playwright GUI $PLAYWRIGHT_BROWSER_URL or press \"\033[32mo\033[0m\"."
        echo -en "\n  * TYPO3 test installation $PLAYWRIGHT_BASE_URL or press \"\033[32mt\033[0m\"."
        echo

        if [ "$(uname)" = "Darwin" ]; then
          OPEN_COMMAND=open
        elif command -v xdg-open > /dev/null 2>&1; then
          OPEN_COMMAND=xdg-open
        fi

        while true; do
        read -rsn1 key
        if [ "$key" = "o" ]; then
            ${OPEN_COMMAND} "$PLAYWRIGHT_BROWSER_URL"
        fi
        if [ "$key" = "t" ]; then
            ${OPEN_COMMAND} "$PLAYWRIGHT_BASE_URL"
        fi
        done </dev/tty
    elif [[ ${PLAYWRIGHT_PREPARE_ONLY} -eq 0 ]]; then
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name playwright-${SUFFIX} -e CHROME_SANDBOX=false -e CI=1 ${IMAGE_PLAYWRIGHT} ${COMMAND}
        SUITE_EXIT_CODE=$?
    else
        PLAYWRIGHT_BASE_URL="http://$(${CONTAINER_BIN} port ac-web-${SUFFIX} 80/tcp)/"
        echo
        echo -en "\033[32m✓\033[0m "
        echo "Environment prepared. You can now press Enter to run all tests or run playwright locally with one of the following commands."
        echo
        echo "  Run with local playwright (headless):"
        echo -n "    "
        echo "PLAYWRIGHT_BASE_URL=${PLAYWRIGHT_BASE_URL}typo3/ ${COMMAND}"
        echo
        echo "  Open local playwright UI:"
        echo -n "    "
        echo "PLAYWRIGHT_BASE_URL=${PLAYWRIGHT_BASE_URL}typo3/ ${COMMAND_UI}"
        echo
        echo -e "(Press \033[31mControl-C\033[0m to quit, \033[32mEnter\033[0m to run tests in container)"
        # maybe use https://stackoverflow.com/a/58508884/4223467
        while read -r _; do
            ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name playwright-${SUFFIX} -e CHROME_SANDBOX=false -e CI=1 ${IMAGE_PLAYWRIGHT} ${COMMAND}
            SUITE_EXIT_CODE=$?
            echo
            echo -e "(Press \033[31mControl-C\033[0m to quit, \033[32mEnter\033[0m to re-run tests in container)"
        done </dev/tty
    fi
}

# Builds an empty composer-installed TYPO3 instance (no `vendor/bin/typo3 setup` performed),
# starts apache/phpfpm and an optional database container, then runs the playwright install
# spec matching the selected -d database. Each invocation rebuilds the instance from scratch
# since the installer mutates state irreversibly.
runPlaywrightInstall() {
    rm -rf "${CORE_ROOT}/typo3temp/var/tests/playwright-install-composer" "${CORE_ROOT}/typo3temp/var/tests/playwright-reports" "${CORE_ROOT}/typo3temp/var/tests/playwright-results"
    ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name playwright-install-prepare ${XDEBUG_MODE} -e COMPOSER_CACHE_DIR=${CORE_ROOT}/.cache/composer -e COMPOSER_ROOT_VERSION=${COMPOSER_ROOT_VERSION} -e XDEBUG_CONFIG="${XDEBUG_CONFIG}" ${IMAGE_PHP} "${CORE_ROOT}/Build/Scripts/setupAcceptanceInstallComposer.sh" "typo3temp/var/tests/playwright-install-composer"
    if [[ $? -gt 0 ]]; then
        kill -SIGINT -$$
    fi

    [[ -e "${CORE_ROOT}/Build/node_modules/.bin/playwright" ]] || ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name playwright-${SUFFIX}-npm-ci \
        -e HOME=${CORE_ROOT}/.cache \
        ${IMAGE_NODEJS_CHROME} \
        npm --prefix=Build ci
        if [[ $? -gt 0 ]]; then
            kill -SIGINT -$$
        fi

    INSTALL_ENV=""
    PLAYWRIGHT_INSTALL_SPEC=""
    case ${DBMS} in
        mariadb)
            ${CONTAINER_BIN} run --rm ${CI_PARAMS} --name mariadb-install-${SUFFIX} --network ${NETWORK} -d -e MYSQL_ROOT_PASSWORD=funcp --tmpfs /var/lib/mysql/:rw,noexec,nosuid ${IMAGE_MARIADB} >/dev/null
            SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
            waitFor mariadb-install-${SUFFIX} 3306
            INSTALL_ENV="-e typo3InstallMysqlDatabaseName=func_test -e typo3InstallMysqlDatabaseUsername=root -e typo3InstallMysqlDatabasePassword=funcp -e typo3InstallMysqlDatabaseHost=mariadb-install-${SUFFIX}"
            PLAYWRIGHT_INSTALL_SPEC="e2e-install/install-mariadb.spec.ts"
            ;;
        mysql)
            ${CONTAINER_BIN} run --rm ${CI_PARAMS} --name mysql-install-${SUFFIX} --network ${NETWORK} -d -e MYSQL_ROOT_PASSWORD=funcp --tmpfs /var/lib/mysql/:rw,noexec,nosuid ${IMAGE_MYSQL} >/dev/null
            SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
            waitFor mysql-install-${SUFFIX} 3306
            INSTALL_ENV="-e typo3InstallMysqlDatabaseName=func_test -e typo3InstallMysqlDatabaseUsername=root -e typo3InstallMysqlDatabasePassword=funcp -e typo3InstallMysqlDatabaseHost=mysql-install-${SUFFIX}"
            PLAYWRIGHT_INSTALL_SPEC="e2e-install/install-mysql.spec.ts"
            ;;
        postgres)
            ${CONTAINER_BIN} run --rm ${CI_PARAMS} --name postgres-install-${SUFFIX} --network ${NETWORK} -d -e POSTGRES_PASSWORD=funcp -e POSTGRES_USER=funcu -e POSTGRES_DB=func_test --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid ${IMAGE_POSTGRES} >/dev/null
            SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
            waitFor postgres-install-${SUFFIX} 5432
            INSTALL_ENV="-e typo3InstallPostgresqlDatabasePort=5432 -e typo3InstallPostgresqlDatabaseName=func_test -e typo3InstallPostgresqlDatabaseHost=postgres-install-${SUFFIX} -e typo3InstallPostgresqlDatabaseUsername=funcu -e typo3InstallPostgresqlDatabasePassword=funcp"
            PLAYWRIGHT_INSTALL_SPEC="e2e-install/install-postgresql.spec.ts"
            ;;
        sqlite)
            PLAYWRIGHT_INSTALL_SPEC="e2e-install/install-sqlite.spec.ts"
            ;;
    esac

    APACHE_OPTIONS="-e APACHE_RUN_USER=#${HOST_UID} -e APACHE_RUN_SERVERNAME=web -e APACHE_RUN_GROUP=#${HOST_PID} -e APACHE_RUN_DOCROOT=${CORE_ROOT}/typo3temp/var/tests/playwright-install-composer/public -e PHPFPM_HOST=phpfpm -e PHPFPM_PORT=9000"
    if [[ ${PLAYWRIGHT_PREPARE_ONLY} -eq 1 || ${PLAYWRIGHT_BROWSER} -eq 1 ]]; then
        APACHE_OPTIONS="${APACHE_OPTIONS} -p 127.0.0.1::80"
    fi

    if [ ${CONTAINER_BIN} = "docker" ]; then
        ${CONTAINER_BIN} run --rm -d --name ac-phpfpm-${SUFFIX} --network ${NETWORK} --network-alias phpfpm --add-host "${CONTAINER_HOST}:host-gateway" ${USERSET} -e PHPFPM_USER=${HOST_UID} -e PHPFPM_GROUP=${HOST_PID} -e PHPFPM_PM_MAX_CHILDREN=50 -e PHPFPM_PM_START_SERVERS=10 -e PHPFPM_PM_MIN_SPARE_SERVERS=5 -e PHPFPM_PM_MAX_SPARE_SERVERS=15 -v ${CORE_ROOT}:${CORE_ROOT} ${IMAGE_PHP} php-fpm ${PHP_FPM_OPTIONS} >/dev/null
        SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
        ${CONTAINER_BIN} run --rm -d --name ac-web-${SUFFIX} --network ${NETWORK} --network-alias web --add-host "${CONTAINER_HOST}:host-gateway" -v ${CORE_ROOT}:${CORE_ROOT} ${APACHE_OPTIONS} ${IMAGE_APACHE} >/dev/null
        SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
    else
        ${CONTAINER_BIN} run ${CI_PARAMS} -d --name ac-phpfpm-${SUFFIX} --network ${NETWORK} --network-alias phpfpm ${USERSET} -e PHPFPM_USER=0 -e PHPFPM_GROUP=0 -e PHPFPM_PM_MAX_CHILDREN=50 -e PHPFPM_PM_START_SERVERS=10 -e PHPFPM_PM_MIN_SPARE_SERVERS=5 -e PHPFPM_PM_MAX_SPARE_SERVERS=15 -v ${CORE_ROOT}:${CORE_ROOT} ${IMAGE_PHP} php-fpm -R ${PHP_FPM_OPTIONS} >/dev/null
        SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
        ${CONTAINER_BIN} run --rm ${CI_PARAMS} -d --name ac-web-${SUFFIX} --network ${NETWORK} --network-alias web -v ${CORE_ROOT}:${CORE_ROOT} ${APACHE_OPTIONS} ${IMAGE_APACHE} >/dev/null
        SUITE_EXIT_CODE=$? && [[ "${SUITE_EXIT_CODE}" -ne 0 ]] && printSummary
    fi

    waitFor web 80

    COMMAND="npm --prefix=${CORE_ROOT}/Build run playwright:run -- ${PLAYWRIGHT_INSTALL_SPEC} ${PLAYWRIGHT_PROJECT}"
    COMMAND_UI="npm --prefix=${CORE_ROOT}/Build run playwright:open -- ${PLAYWRIGHT_INSTALL_SPEC} ${PLAYWRIGHT_PROJECT}"
    PLAYWRIGHT_GUI_PORT=43837

    if [[ ${PLAYWRIGHT_PREPARE_ONLY} -eq 0 && ${PLAYWRIGHT_BROWSER} -eq 1 ]]; then
        PLAYWRIGHT_BASE_URL="http://$(${CONTAINER_BIN} port ac-web-${SUFFIX} 80/tcp)/"
        ${CONTAINER_BIN} run -d ${CONTAINER_COMMON_PARAMS} --name ac-browser-${SUFFIX} -p $PLAYWRIGHT_GUI_PORT -e CHROME_SANDBOX=false -e PLAYWRIGHT_BASE_URL=http://web:80/ ${INSTALL_ENV} ${IMAGE_PLAYWRIGHT} ${COMMAND} --ui --ui-port=$PLAYWRIGHT_GUI_PORT --ui-host=0.0.0.0 > /dev/null 2>&1
        SUITE_EXIT_CODE=$?
        PLAYWRIGHT_BROWSER_URL="http://127.0.0.1:$(${CONTAINER_BIN} port ac-browser-${SUFFIX} ${PLAYWRIGHT_GUI_PORT}/tcp | head -n 1 | cut -d: -f2)"

        echo -en "\033[32m✓\033[0m Playwright is ready..."
        echo -en "\n  * Playwright GUI $PLAYWRIGHT_BROWSER_URL or press \"\033[32mo\033[0m\"."
        echo -en "\n  * TYPO3 test installation $PLAYWRIGHT_BASE_URL or press \"\033[32mt\033[0m\"."
        echo

        if [ "$(uname)" = "Darwin" ]; then
          OPEN_COMMAND=open
        elif command -v xdg-open > /dev/null 2>&1; then
          OPEN_COMMAND=xdg-open
        fi

        while true; do
        read -rsn1 key
        if [ "$key" = "o" ]; then
            ${OPEN_COMMAND} "$PLAYWRIGHT_BROWSER_URL"
        fi
        if [ "$key" = "t" ]; then
            ${OPEN_COMMAND} "$PLAYWRIGHT_BASE_URL"
        fi
        done </dev/tty
    elif [[ ${PLAYWRIGHT_PREPARE_ONLY} -eq 0 ]]; then
        ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name e2e-install-${SUFFIX} -e CHROME_SANDBOX=false -e CI=1 ${INSTALL_ENV} ${IMAGE_PLAYWRIGHT} ${COMMAND}
        SUITE_EXIT_CODE=$?
    else
        PLAYWRIGHT_BASE_URL="http://$(${CONTAINER_BIN} port ac-web-${SUFFIX} 80/tcp)/"
        echo
        echo -en "\033[32m✓\033[0m "
        echo "Environment prepared. The installer mutates state irreversibly: re-run \`runTests.sh -s e2e-install-prepare -d ${DBMS}\` to reset between iterations."
        echo
        echo "  Run with local playwright (headless):"
        echo -n "    "
        echo "PLAYWRIGHT_BASE_URL=${PLAYWRIGHT_BASE_URL} ${COMMAND}"
        echo
        echo "  Open local playwright UI:"
        echo -n "    "
        echo "PLAYWRIGHT_BASE_URL=${PLAYWRIGHT_BASE_URL} ${COMMAND_UI}"
        echo
        echo -e "(Press \033[31mControl-C\033[0m to quit, \033[32mEnter\033[0m to run tests in container)"
        while read -r _; do
            ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name e2e-install-${SUFFIX} -e CHROME_SANDBOX=false -e CI=1 ${INSTALL_ENV} ${IMAGE_PLAYWRIGHT} ${COMMAND}
            SUITE_EXIT_CODE=$?
            echo
            echo -e "(Press \033[31mControl-C\033[0m to quit, \033[32mEnter\033[0m to re-run tests in container)"
        done </dev/tty
    fi
}

executeRstRendering() {
    local systemExtensionName="$1"
    local systemExtensionFolder="typo3/sysext/${systemExtensionName}"
    if [[ ! -d "${systemExtensionFolder}/Documentation" ]]; then
        return 1
    fi
    echo "Processing RST directory: ${systemExtensionFolder}/Documentation"
    ${CONTAINER_BIN} run ${CONTAINER_COMMON_PARAMS} --name check-rst-rendering-${systemExtensionName}-${SUFFIX}  -w /project -v "${CORE_ROOT}/${systemExtensionFolder}:/project" ${IMAGE_RSTRENDERING} --fail-on-log --fail-on-error --no-progress --config=Documentation Documentation
    local exitCode=$?
    echo "Render result for ${systemExtensionFolder}: ${exitCode}"
    return ${exitCode}
}

executeRstRenderingWithWatch() {
    local GREEN='\033[0;32m'
    local YELLOW='\033[1;33m'
    local RED='\033[1;31m'
    local NC='\033[0m' # No Color

    local systemExtensionName="$1"
    local entryFile="$2"
    local portOverride="$3"

    if [[ "${portOverride}x" != "x" ]]; then
        local actualRstPort="${portOverride}"
    else
        local actualRstPort="${RST_PORT}"
    fi

    local systemExtensionFolder="typo3/sysext/${systemExtensionName}"
    if [[ ! -d "${systemExtensionFolder}/Documentation" ]]; then
        return 1
    fi

    if [[ "${systemExtensionKey}" == "core" ]]; then
        echo -e "${GREEN}Hint:${NC} For the 'core' documentation (Changelog), a second argument can directly create/use a new entry."
        echo -e "Use '${YELLOW}interactive${NC}' for an interactive file creation process."
        echo "Example:"
        echo "# Create a new file (if the file already exists, it is utilized)"
        echo "./Build/Scripts/runTests.sh -s watchRst core Changelog/${RST_TYPO3_MAIN_VERSION}/Feature-12343-MyFeature.rst"
        echo "# Interactively ask for the target file, created in "${RST_TYPO3_MAIN_VERSION}" (branch dependent)"
        echo "./Build/Scripts/runTests.sh -s watchRst core interactive"
        echo "# Run on port different than ${RST_PORT}"
        echo "./Build/Scripts/runTests.sh -s watchRst core interactive 4711"
        echo ""

        if [[ "${entryFile}x" != "x" ]]; then
            if [[ "${entryFile}" == "interactive" ]]; then
                echo "What kind of changelog should be created?"
                echo "1) Feature"
                echo "2) Breaking"
                echo "3) Important"
                echo "4) Deprecation"
                echo -en "${GREEN}Enter your choice (1-4)${NC}: "
                read -r choice

                case $choice in
                    1) local issueType="Feature" ;;
                    2) local issueType="Breaking" ;;
                    3) local issueType="Important" ;;
                    4) local issueType="Deprecation" ;;
                    *)
                        echo -e "${RED}Invalid choice. Exiting.${NC}"
                        return 1
                        ;;
                esac

                echo -en "${GREEN}Enter issue number for this ${YELLOW}${issueType}${GREEN} file${NC}: "
                read -r issueNumber
                local issueNumber=$(echo "$issueNumber" | sed 's/[^0-9]//g')

                echo -en "${GREEN}Enter title for issue #${issueNumber} (spaces are removed in filename) ${NC}: "
                read -r issueTitle

                local issueFileTitle=$(echo "$issueTitle" | sed 's/[^a-zA-Z_0-9-]//g')

                local newFile="Changelog/${RST_TYPO3_MAIN_VERSION}/${issueType}-${issueNumber}-${issueFileTitle}.rst"
            else
                # non-interactive mode and file not existing. Let's evaluate some stuff!
                local pattern='^Changelog/([0-9.]+)/(Breaking|Important|Feature|Deprecation)-([0-9]+)-(.+)\.rst$'
                if [[ $entryFile =~ $pattern ]]; then
                    local issueType="${BASH_REMATCH[2]}"
                    local issueNumber="${BASH_REMATCH[3]}"
                    local issueFileTitle="${BASH_REMATCH[4]}"
                    local issueTitle="${issueFileTitle}"
                else
                    echo -e "${RED}Invalid filename, does not match changelog pattern: ${YELLOW}${pattern}${RED} - exiting.${NC}"
                    return 1
                fi
                local newFile="${entryFile}"
            fi

            local fullTargetFile="${systemExtensionFolder}/Documentation/${newFile}"
            local templateFile="../rstTemplates/rstTemplate${issueType}.rst"

            # This will also be triggered for a filename "interactive", since this will not yet exist
            if [[ ! -f "${fullTargetFile}" ]]; then
                local fullTemplateFile="${THIS_SCRIPT_DIR}/${templateFile}"
                echo -e "Creating: ${GREEN}${fullTargetFile}${NC}"
                echo -e "Template: ${YELLOW}${fullTemplateFile}${NC}"

                local escapedTitle=$(printf '%s\n' "$issueTitle" | sed 's/[&/\]/\\&/g')
                local escapedIssue=$(printf '%s\n' "$issueNumber" | sed 's/[&/\]/\\&/g')
                local escapedTimestamp=$(date +%s)

                local creationPath=$(dirname "${fullTargetFile}")
                if [[ ! -d "${creationPath}" ]]; then
                    echo -e "${RED}${creationPath}${NC} is not a valid directory, no file could be created."
                    return 1
                fi

                sed -e "s/{ISSUE}/$escapedIssue/g;" \
                    -e "s/{TITLE}/$escapedTitle/g;" \
                    -e "s/{TIMESTAMP}/$escapedTimestamp/g;" \
                    "${fullTemplateFile}" > "${fullTargetFile}"

                echo -e "${GREEN} ✓ New file created${NC}"
                echo ""
            fi

            if [[ ! -f "${fullTargetFile}" ]]; then
                echo -e "${RED}${fullTargetFile}${NC} could not be found and could not be created."
                return 1
            fi
        fi
    else
        echo -e "${YELLOW}HINT: File creation only works for EXT:core context."
        echo -e "For other manuals, please create files distinctively, because the follow no pattern."
        echo -e "Filename input is ignored.${NC}"
        echo ""
    fi

    echo -e "${YELLOW}NOTICE: Live documentation rendering is an experimental feature.${NC}"
    echo "  - Adding new files after the process is running will not include them"
    echo "  - Navigation / Menus on live-rendering may not fully work"
    echo "  - Leaving the process running for a long time may cause memory leaks / consumption"
    echo ""
    echo "After the initial rendering is done, you can access the local browser and edit the file"
    echo "simultaneously. Every time the file is changed, your browser will automatically reload"
    echo "the page, and scroll to the last position."
    echo ""

    local htmlFile="${newFile%.rst}.html"
    echo -e "Processing RST directory: ${GREEN}${systemExtensionFolder}/Documentation${NC}"
    if [[ -f "${fullTargetFile}" ]]; then
        echo -e "Working on: ${GREEN}${newFile}${NC}"
        echo -e "Browser URL: ${GREEN}http://localhost:${actualRstPort}/${htmlFile}${NC}"
    else
        echo -e "Browser URL: ${GREEN}http://localhost:${actualRstPort}/${NC}"
    fi

    echo -e "(Press ${RED}Control-C${NC} when finished writing documentation)"
    echo ""

    # Command taken from Playwright example
    if [ ${CONTAINER_BIN} = "docker" ]; then
        ${CONTAINER_BIN} run -it --name watch-rst-rendering-${systemExtensionName}-${SUFFIX} -p ${actualRstPort}:${actualRstPort} --network ${NETWORK} --network-alias watch-rst --add-host "${CONTAINER_HOST}:host-gateway" -w /project -v "${CORE_ROOT}/${systemExtensionFolder}:/project" ${IMAGE_RSTRENDERING} --port ${actualRstPort} --watch --config=Documentation Documentation
    else
        ${CONTAINER_BIN} run -it ${CI_PARAMS} --name watch-rst-rendering-${systemExtensionName}-${SUFFIX} -p ${actualRstPort}:${actualRstPort} --network ${NETWORK} --network-alias watch-rst -w /project -v "${CORE_ROOT}/${systemExtensionFolder}:/project" ${IMAGE_RSTRENDERING} --port ${actualRstPort} --watch --config=Documentation Documentation
    fi

    local exitCode=$?
    echo "Render result for ${systemExtensionFolder}: ${exitCode}"
    return ${exitCode}
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
            - clean: clean up build, cache and testing related files
            - cleanCache: clean up cache related files
            - composerInstall: "composer install", use after initial clone
            - functional: functional tests
            - lintJs: javascript/typescript linting
            - lintPhp: PHP linting
            - npmInstall: "npm ci", use after initial clone
            - phpstan: phpstan analyze
            - renderDocs: render documentation using the PHP-based renderer
            - unit: PHP unit tests (default)
            - composer: "composer" command dispatcher, to execute various composer commands
            - npm: "npm" command dispatcher, to execute various npm commands directly

    -b <docker|podman>
        Container environment:
            - podman (default)
            - docker

    -t <13|14>
        TYPO3 core version to use (default: 13)

    -p <8.2|8.3|8.4>
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
        Only with -s cgl
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
CHUNKS=0
THISCHUNK=0
CONTAINER_BIN=""
COMPOSER_ROOT_VERSION="0.1.0-dev"
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
while getopts ":a:b:s:c:d:i:p:t:xy:nhu" OPT; do
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
        c)
            if ! [[ ${OPTARG} =~ ^([0-9]+\/[0-9]+)$ ]]; then
                INVALID_OPTIONS+=("${OPTARG}")
            else
                CHUNKS=${OPTARG%/*}
                THISCHUNK=${OPTARG#*/}
            fi
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

IMAGE_APACHE="ghcr.io/typo3/core-testing-apache24:1.7"
IMAGE_PHP="ghcr.io/typo3/core-testing-$(echo "php${PHP_VERSION}" | sed -e 's/\.//'):$(getPhpImageVersion $PHP_VERSION)"

IMAGE_NODEJS="ghcr.io/typo3/core-testing-nodejs24:1.1"
IMAGE_NODEJS_CHROME="ghcr.io/typo3/core-testing-nodejs24-chrome:1.1"
IMAGE_PLAYWRIGHT="mcr.microsoft.com/playwright:v1.56.1-noble"
IMAGE_REDIS="docker.io/redis:4-alpine"
IMAGE_MEMCACHED="docker.io/memcached:1.5-alpine"
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
        cleanCacheFiles
        cleanTestFiles
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
        COMMAND=(--config=Documentation --output=var/documentation --no-progress)
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
